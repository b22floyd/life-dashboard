"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addGroceryItem,
  addGroceryStaple,
  addStapleToGroceryList,
  clearCheckedGroceryItems,
  deleteGroceryStaple,
  toggleGroceryItem,
  type AddGroceryItemState,
  type AddStapleState,
} from "@/app/actions/grocery";
import type { GroceryItem, GroceryStaple } from "@/lib/grocery-utils";
import { SectionLoadError } from "./SectionLoadError";

const initialAddItemState: AddGroceryItemState = null;
const initialAddStapleState: AddStapleState = null;

export function GroceryListSection({
  items,
  staples,
}: {
  items: GroceryItem[] | null;
  staples: GroceryStaple[] | null;
}) {
  const router = useRouter();
  // Null means that particular list failed to load — adding a new item or
  // staple doesn't depend on the other having loaded, so both forms below
  // still work; only the affected list shows a load error instead of a
  // misleading "No items yet."
  const itemsLoadFailed = items === null;
  const safeItems = items ?? [];
  const safeStaples = staples ?? [];

  const [addItemState, addItemFormAction, isAddingItem] = useActionState(
    addGroceryItem,
    initialAddItemState,
  );
  const itemFormRef = useRef<HTMLFormElement>(null);
  const itemSubmittedRef = useRef(false);

  const [addStapleState, addStapleFormAction, isAddingStaple] = useActionState(
    addGroceryStaple,
    initialAddStapleState,
  );
  const stapleFormRef = useRef<HTMLFormElement>(null);
  const stapleSubmittedRef = useRef(false);

  const [localItems, setLocalItems] = useState(safeItems);
  const [handledItems, setHandledItems] = useState(items);
  if (items !== handledItems) {
    setHandledItems(items);
    setLocalItems(safeItems);
  }

  const [localStaples, setLocalStaples] = useState(safeStaples);
  const [handledStaples, setHandledStaples] = useState(staples);
  if (staples !== handledStaples) {
    setHandledStaples(staples);
    setLocalStaples(safeStaples);
  }

  const [actionError, setActionError] = useState<string | null>(null);
  const [, startTransitionAction] = useTransition();

  useEffect(() => {
    if (itemSubmittedRef.current && !isAddingItem) {
      itemSubmittedRef.current = false;
      if (!addItemState?.error) itemFormRef.current?.reset();
    }
  }, [addItemState, isAddingItem]);

  useEffect(() => {
    if (stapleSubmittedRef.current && !isAddingStaple) {
      stapleSubmittedRef.current = false;
      if (!addStapleState?.error) stapleFormRef.current?.reset();
    }
  }, [addStapleState, isAddingStaple]);

  function handleToggle(item: GroceryItem) {
    setActionError(null);
    setLocalItems((current) =>
      current.map((i) => (i.id === item.id ? { ...i, checked: !i.checked } : i)),
    );
    startTransitionAction(async () => {
      const result = await toggleGroceryItem(item.id, !item.checked);
      if ("error" in result) setActionError(result.error);
      router.refresh();
    });
  }

  function handleClearChecked() {
    setActionError(null);
    setLocalItems((current) => current.filter((i) => !i.checked));
    startTransitionAction(async () => {
      const result = await clearCheckedGroceryItems();
      if ("error" in result) setActionError(result.error);
      router.refresh();
    });
  }

  function handleDeleteStaple(stapleId: string) {
    setActionError(null);
    setLocalStaples((current) => current.filter((s) => s.id !== stapleId));
    startTransitionAction(async () => {
      const result = await deleteGroceryStaple(stapleId);
      if ("error" in result) setActionError(result.error);
      router.refresh();
    });
  }

  function handleQuickAdd(staple: GroceryStaple) {
    setActionError(null);
    setLocalItems((current) => [
      ...current,
      { id: `optimistic-${staple.id}-${Date.now()}`, content: staple.content, checked: false },
    ]);
    startTransitionAction(async () => {
      const result = await addStapleToGroceryList(staple.content);
      if ("error" in result) setActionError(result.error);
      router.refresh();
    });
  }

  const hasChecked = localItems.some((item) => item.checked);

  return (
    <div>
      <h3 className="mb-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">Grocery List</h3>

      {/* Tap a staple to quick-add it below; the small ✕ removes it from
          your staples list, not from the active grocery list. */}
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {localStaples.map((staple) => (
          <span
            key={staple.id}
            className="flex items-center gap-1 rounded-full border border-zinc-300 bg-white px-2 py-0.5 text-xs text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
          >
            <button
              type="button"
              onClick={() => handleQuickAdd(staple)}
              className="hover:text-zinc-900 dark:hover:text-zinc-100"
            >
              + {staple.content}
            </button>
            <button
              type="button"
              onClick={() => handleDeleteStaple(staple.id)}
              aria-label={`Remove ${staple.content} from staples`}
              className="text-zinc-400 hover:text-red-600 dark:text-zinc-500 dark:hover:text-red-400"
            >
              ✕
            </button>
          </span>
        ))}
        <form
          ref={stapleFormRef}
          action={addStapleFormAction}
          onSubmit={() => {
            stapleSubmittedRef.current = true;
          }}
          className="flex items-center gap-1"
        >
          <input
            type="text"
            name="content"
            placeholder="Add staple"
            className="w-24 rounded-full border border-dashed border-zinc-300 bg-transparent px-2 py-0.5 text-xs text-zinc-600 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:text-zinc-300"
          />
          <button
            type="submit"
            disabled={isAddingStaple}
            className="text-xs font-medium text-zinc-400 hover:text-zinc-700 disabled:opacity-50 dark:text-zinc-500 dark:hover:text-zinc-300"
          >
            {isAddingStaple ? "…" : "Add"}
          </button>
        </form>
      </div>
      {addStapleState?.error && (
        <p className="mb-2 text-sm text-red-600 dark:text-red-400">{addStapleState.error}</p>
      )}

      <form
        ref={itemFormRef}
        action={addItemFormAction}
        onSubmit={() => {
          itemSubmittedRef.current = true;
        }}
        className="mb-3 flex gap-2"
      >
        <input
          type="text"
          name="content"
          placeholder="Add an item"
          className="min-w-0 flex-1 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-sm text-zinc-800 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-200"
        />
        <button
          type="submit"
          disabled={isAddingItem}
          className="shrink-0 rounded-full bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {isAddingItem ? "Adding…" : "Add"}
        </button>
      </form>

      {addItemState?.error && (
        <p className="mb-2 text-sm text-red-600 dark:text-red-400">{addItemState.error}</p>
      )}
      {actionError && <p className="mb-2 text-sm text-red-600 dark:text-red-400">{actionError}</p>}

      {itemsLoadFailed ? (
        <SectionLoadError message="Couldn't load your grocery list right now." />
      ) : localItems.length === 0 ? (
        <p className="text-sm text-zinc-400 dark:text-zinc-500">No items yet — add one above.</p>
      ) : (
        <ul className="flex max-h-60 flex-col gap-2 overflow-y-auto">
          {localItems.map((item) => (
            <li key={item.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={item.checked}
                onChange={() => handleToggle(item)}
                className="h-4 w-4 shrink-0 rounded border-zinc-300 text-zinc-900 dark:border-zinc-700"
              />
              <span
                className={
                  item.checked
                    ? "text-sm text-zinc-400 line-through dark:text-zinc-500"
                    : "text-sm text-zinc-700 dark:text-zinc-300"
                }
              >
                {item.content}
              </span>
            </li>
          ))}
        </ul>
      )}

      {hasChecked && (
        <button
          type="button"
          onClick={handleClearChecked}
          className="mt-2 block text-xs font-medium text-zinc-400 hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-300"
        >
          Clear checked
        </button>
      )}
    </div>
  );
}
