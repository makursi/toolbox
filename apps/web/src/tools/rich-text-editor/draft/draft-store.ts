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

/** What each operation is called when the browser refuses it. */
const FAILURE = {
  read: "the draft could not be read",
  remove: "the stored draft could not be removed",
  write: "the draft could not be written",
} as const;

type Operation = keyof typeof FAILURE;

/**
 * Run one request in one transaction against the store, and settle with its value.
 *
 * The three operations are the same eight lines around one `get`, `put` or
 * `delete`: open a transaction, make the request, and turn whichever of the four
 * events fires first into a settlement. Written once, so the failure from a
 * refusal reaches the hook by the same path for all three — a refused write (a
 * quota, a clone error) rejects on the request's own `error`, and the abort that
 * follows it is ignored because the promise has already settled.
 *
 * A read settles on the request's `success` (its value is in hand); a write
 * settles on the transaction's `complete`, because resolving before the
 * transaction commits would report 已保存到本机 for a write the browser has not
 * accepted yet. Calling `resolve` twice is harmless: the second call is ignored.
 */
function inStore<T>(
  database: IDBDatabase,
  operation: Operation,
  mode: "readonly" | "readwrite",
  request: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode);
    const made = request(transaction.objectStore(STORE_NAME));

    made.addEventListener("success", () => {
      if (mode === "readonly") resolve(made.result);
    });
    made.addEventListener("error", () => reject(made.error ?? new Error(FAILURE[operation])));
    transaction.addEventListener("complete", () => resolve(made.result));
    transaction.addEventListener("error", () =>
      reject(transaction.error ?? new Error(`${FAILURE[operation]} (the transaction failed)`)),
    );
    transaction.addEventListener("abort", () =>
      reject(transaction.error ?? new Error(`${FAILURE[operation]} (the transaction was aborted)`)),
    );
  });
}

/** Read the one draft, or `null` when the store has none this build can use. */
export async function loadDraft(): Promise<StoredDraft | null> {
  const database = await openDatabase();
  const value: unknown = await inStore(database, "read", "readonly", (store) =>
    store.get(DRAFT_KEY),
  );

  // The record is validated in the core, not here: a value that is not a draft is
  // treated as no draft, which is the silent mount the page promises.
  return isStoredDraft(value) ? value : null;
}

/** Write the one draft, resolving only when the transaction has committed. */
export async function writeDraft(draft: StoredDraft): Promise<void> {
  const database = await openDatabase();

  await inStore(database, "write", "readwrite", (store) => store.put(draft, DRAFT_KEY));
}

/** Remove the one draft; a reload then finds no draft to restore. */
export async function removeDraft(): Promise<void> {
  const database = await openDatabase();

  await inStore(database, "remove", "readwrite", (store) => store.delete(DRAFT_KEY));
}
