import { createClient } from "@/lib/supabase/server";
import type { GroceryItem, GroceryStaple } from "@/lib/grocery-utils";

// Null means "failed to load" — distinct from an empty array (grocery list
// genuinely empty).
export async function getGroceryItems(): Promise<GroceryItem[] | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("grocery_items")
    .select("id, content, checked")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Failed to load grocery items:", error.message);
    return null;
  }

  return data ?? [];
}

export async function getGroceryStaples(): Promise<GroceryStaple[] | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("grocery_staples")
    .select("id, content")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Failed to load grocery staples:", error.message);
    return null;
  }

  return data ?? [];
}
