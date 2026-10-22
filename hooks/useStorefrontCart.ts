"use client";

import { useState, useEffect } from "react";

export interface CartItem {
  id: string;
  sku: string;
  title: string;
  price: number;
  mrp: number;
  unit: string;
  quantity: number;
  image?: string;
  brand?: string;
}

const CART_STORAGE_KEY = "bkwiringkade_cart";
const QUOTE_STORAGE_KEY = "bkwiringkade_quote";

export function useStorefrontCart() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [quoteItems, setQuoteItems] = useState<CartItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from localStorage on client
  useEffect(() => {
    try {
      const savedCart = localStorage.getItem(CART_STORAGE_KEY);
      if (savedCart) setCart(JSON.parse(savedCart));

      const savedQuote = localStorage.getItem(QUOTE_STORAGE_KEY);
      if (savedQuote) setQuoteItems(JSON.parse(savedQuote));
    } catch (e) {
      console.warn("Failed to load cart from storage", e);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // Save changes
  const saveCart = (newCart: CartItem[]) => {
    setCart(newCart);
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(newCart));
    } catch {}
  };

  const saveQuote = (newQuote: CartItem[]) => {
    setQuoteItems(newQuote);
    try {
      localStorage.setItem(QUOTE_STORAGE_KEY, JSON.stringify(newQuote));
    } catch {}
  };

  // Add to cart
  const addToCart = (product: any, qty = 1) => {
    const existingIdx = cart.findIndex((i) => i.id === product.id);
    let updated: CartItem[];
    if (existingIdx > -1) {
      updated = [...cart];
      updated[existingIdx].quantity += qty;
    } else {
      updated = [
        ...cart,
        {
          id: product.id,
          sku: product.sku || "-",
          title: product.title || product.name,
          price: Number(product.price || product.onlinePrice || 0),
          mrp: Number(product.mrp || product.price || 0),
          unit: product.unit || product.unitOfMeasure || "Pcs",
          quantity: qty,
          image: product.images?.[0] || "",
          brand: product.brand || "",
        },
      ];
    }
    saveCart(updated);
  };

  // Add to quotation list
  const addToQuote = (product: any, qty = 1) => {
    const existingIdx = quoteItems.findIndex((i) => i.id === product.id);
    let updated: CartItem[];
    if (existingIdx > -1) {
      updated = [...quoteItems];
      updated[existingIdx].quantity += qty;
    } else {
      updated = [
        ...quoteItems,
        {
          id: product.id,
          sku: product.sku || "-",
          title: product.title || product.name,
          price: Number(product.price || product.onlinePrice || 0),
          mrp: Number(product.mrp || product.price || 0),
          unit: product.unit || product.unitOfMeasure || "Pcs",
          quantity: qty,
          image: product.images?.[0] || "",
          brand: product.brand || "",
        },
      ];
    }
    saveQuote(updated);
  };

  const updateQuantity = (id: string, qty: number) => {
    if (qty <= 0) {
      removeFromCart(id);
    } else {
      const updated = cart.map((i) => (i.id === id ? { ...i, quantity: qty } : i));
      saveCart(updated);
    }
  };

  const removeFromCart = (id: string) => {
    const updated = cart.filter((i) => i.id !== id);
    saveCart(updated);
  };

  const clearCart = () => {
    saveCart([]);
  };

  const clearQuote = () => {
    saveQuote([]);
  };

  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const quoteTotal = quoteItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const quoteCount = quoteItems.reduce((sum, item) => sum + item.quantity, 0);

  return {
    cart,
    quoteItems,
    isLoaded,
    addToCart,
    addToQuote,
    updateQuantity,
    removeFromCart,
    clearCart,
    clearQuote,
    cartTotal,
    cartCount,
    quoteTotal,
    quoteCount,
  };
}
