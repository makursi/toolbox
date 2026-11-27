import { isStoredDraft, type StoredDraft } from "../core/draft";

/**
 * The draft store: one IndexedDB database, one object store, one record.
 *
 * Hand-written because the Tool needs four things and every wrapper around
 * IndexedDB is a dependency larger than those four: open, read, write, delete. The
 * store is private to this Tool and the record shape is in `core/draft.ts`; this
 * module only moves it in and out.
 *
 * The database opens lazily, on the first read or write. `next start` serves the
 * page before hydration, so nothing here may run at import time: the server has no
 * `indexedDB`, and a module that opened a connection on import would break the
 * prerender. Every function rejects with the browser's own error rather than
 * inventing one; the hook decides which of those failures reaches the interface.
 */
const DATABASE_NAME = "rich-text-editor";
const DATABASE_VERSION = 1;
const STORE_NAME = "drafts";
export const DRAFT_KEY = "draft";

/** The open connection is shared, so the upgrade runs at most once per page. */
let connection: Promise<IDBDatabase> | null = null;

function openDatabase(): Promise<IDBDatabase> {
  if (connection !== null) return connection;

  const opening = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("this browser exposes no IndexedDB for the draft"));
      return;
    }

    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.addEventListener("upgradeneeded", () => {
      const database = request.result;

      /*
       * One object store and no indexes: the single record is read by its key, and
       * an index would be a second way to ask the same question. The store is
       * created only when it is not there, so a future version that adds a store
       * does not have to guard this one.
       */
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
      }
    });

    request.addEventListener("success", () => {
      const database = request.result;

      // A newer build opening the database asks this page to let go; refusing
      // would block the upgrade, so the connection follows the browser's request.
      database.addEventListener("versionchange", () => {
        database.close();
        connection = null;
      });

      resolve(database);
    });

    request.addEventListener("error", () =>
      reject(request.error ?? new Error("the draft database could not open")),
    );
    request.addEventListener("blocked", () =>
      reject(new Error("the draft database is blocked by another tab")),
    );
  });

  /*
   * A failed open is not cached: a later save can try again, which is exactly what
   * the failure state's retry is for. The handler consumes this branch of the
   * rejection so returning the original promise below cannot leave it unhandled.
   */
  opening.catch(() => {
    connection = null;
  });
  connection = opening;

  return opening;
}

/** Read the one draft, or `null` when the store has none this build can use. */
export async function loadDraft(): Promise<StoredDraft | null> {
  const database = await openDatabase();

  return new Promise<StoredDraft | null>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).get(DRAFT_KEY);

    request.addEventListener("success", () => {
      const value: unknown = request.result;

      if (value === undefined) {
        resolve(null);
        return;
      }

      // The record is validated in the core, not here: a value that is not a draft
      // is treated as no draft, which is the silent mount the page promises.
      resolve(isStoredDraft(value) ? value : null);
    });

    request.addEventListener("error", () =>
      reject(request.error ?? new Error("the draft could not be read")),
    );
    transaction.addEventListener("abort", () =>
      reject(transaction.error ?? new Error("the draft read was aborted")),
    );
  });
}

/** Write the one draft, resolving only when the transaction has committed. */
export async function writeDraft(draft: StoredDraft): Promise<void> {
  const database = await openDatabase();

  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const request = transaction.objectStore(STORE_NAME).put(draft, DRAFT_KEY);

    request.addEventListener("error", () => {
      // A refused write (a quota, a clone error) must reach the hook as a
      // rejection; the transaction's own abort follows and is ignored here.
      reject(request.error ?? new Error("the draft could not be written"));
    });
    transaction.addEventListener("complete", () => resolve());
    transaction.addEventListener("error", () =>
      reject(transaction.error ?? new Error("the draft write failed")),
    );
    transaction.addEventListener("abort", () =>
      reject(transaction.error ?? new Error("the draft write was aborted")),
    );
  });
}

/** Remove the one draft; a reload then finds no draft to restore. */
export async function removeDraft(): Promise<void> {
  const database = await openDatabase();

  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const request = transaction.objectStore(STORE_NAME).delete(DRAFT_KEY);

    request.addEventListener("error", () =>
      reject(request.error ?? new Error("the stored draft could not be removed")),
    );
    transaction.addEventListener("complete", () => resolve());
    transaction.addEventListener("error", () =>
      reject(transaction.error ?? new Error("the stored draft removal failed")),
    );
    transaction.addEventListener("abort", () =>
      reject(transaction.error ?? new Error("the stored draft removal was aborted")),
    );
  });
}
