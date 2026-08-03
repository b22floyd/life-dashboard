"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type GroceryActionResult = { success: true } | { error: string };

export type AddGroceryItemState = { error: string } | null;

export async function addGroceryItem(
  _prevState: AddGroceryItemState,
  formData: FormData,
): Promise<AddGroceryItemState> {
  const content = (formData.get("content") as string | null)?.trim();
  if (!content) {
    return { error: "Enter an item before adding." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be signed in to add a grocery item." };
  }

  const { error } = await supabase.from("grocery_items").insert({ content });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/");
  return null;
}

// Same insert as addGroceryItem, but as a plain callable rather than a
// form action — used by the staple "quick add" chips, which aren't forms.
export async function addStapleToGroceryList(content: string): Promise<GroceryActionResult> {
  const trimmed = content.trim();
  if (!trimmed) {
    return { error: "Staple has no content." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be signed in to add a grocery item." };
  }

  const { error } = await supabase.from("grocery_items").insert({ content: trimmed });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/");
  return { success: true };
}

export async function toggleGroceryItem(
  itemId: string,
  checked: boolean,
): Promise<GroceryActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be signed in to update a grocery item." };
  }

  const { error } = await supabase
    .from("grocery_items")
    .update({ checked })
    .eq("id", itemId)
    .eq("user_id", user.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/");
  return { success: true };
}

// Checked items stay visible (with a strikethrough) until explicitly
// cleared — checking one off doesn't delete it immediately.
export async function clearCheckedGroceryItems(): Promise<GroceryActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be signed in to clear items." };
  }

  const { error } = await supabase
    .from("grocery_items")
    .delete()
    .eq("user_id", user.id)
    .eq("checked", true);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/");
  return { success: true };
}

// Bulk insert, used by the Meal Plan card's ingredient-parsing preview to
// add several items at once — same insert as addGroceryItem, just multiple
// rows in one call.
export async function addItemsToGroceryList(items: string[]): Promise<GroceryActionResult> {
  const cleaned = items.map((item) => item.trim()).filter(Boolean);
  if (cleaned.length === 0) {
    return { error: "No ingredients to add." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be signed in to add grocery items." };
  }

  const { error } = await supabase
    .from("grocery_items")
    .insert(cleaned.map((content) => ({ content })));

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/");
  return { success: true };
}

export type AddStapleState = { error: string } | null;

export async function addGroceryStaple(
  _prevState: AddStapleState,
  formData: FormData,
): Promise<AddStapleState> {
  const content = (formData.get("content") as string | null)?.trim();
  if (!content) {
    return { error: "Enter a staple name before adding." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be signed in to add a staple." };
  }

  const { error } = await supabase.from("grocery_staples").insert({ content });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/");
  return null;
}

export async function deleteGroceryStaple(stapleId: string): Promise<GroceryActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be signed in to delete a staple." };
  }

  const { error } = await supabase
    .from("grocery_staples")
    .delete()
    .eq("id", stapleId)
    .eq("user_id", user.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/");
  return { success: true };
}
