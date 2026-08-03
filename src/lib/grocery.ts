import { createClient } from "@/lib/supabase/server";
import type { GroceryItem, GroceryStaple } from "@/lib/grocery-utils";

export async function getGroceryItems(): Promise<GroceryItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("grocery_items")
    .select("id, content, checked")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Failed to load grocery items:", error.message);
    return [];
  }

  return data ?? [];
}

export async function getGroceryStaples(): Promise<GroceryStaple[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("grocery_staples")
    .select("id, content")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Failed to load grocery staples:", error.message);
    return [];
  }

  return data ?? [];
}
