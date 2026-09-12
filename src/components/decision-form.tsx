"use client";

import { useState } from "react";

interface Product {
  code: string;
  name: string;
}

interface GammeVentesProps {
  gamme: Product[];
  values: Record<string, { price: string; productionPlan: string; supplierChoice?: string }>;
  onChange: (productCode: string, field: string, value: string) => void;
  suppliers?: { id: string; name: string }[];
}

export function GammeVentes({ gamme, values, onChange, suppliers = [] }: GammeVentesProps) {
  const [activeProduct, setActiveProduct] = useState(gamme[0]?.code ?? "");

  const activeProductData = values[activeProduct] || { price: "", productionPlan: "", supplierChoice: "" };
  const price = parseFloat(activeProductData.price) || 0;
  const margin = price > 0 ? Math.max(0, price * 0.15) : 0; // Example: 15% margin

  return (
    <div className="space-y-4">
      {/* Product navigation tabs */}
      <div className="flex flex-wrap gap-2">
        {gamme.map((product) => (
          <button
            key={product.code}
            onClick={() => setActiveProduct(product.code)}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition border ${
              activeProduct === product.code
                ? "bg-amber-400/20 border-amber-400/60 text-amber-200"
                : "bg-slate-900 border-white/5 text-slate-400 hover:text-slate-200"
            }`}
          >
            {product.name}
          </button>
        ))}
      </div>

      {/* Product card */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-4">
        <div>
          <h3 className="text-base font-semibold text-slate-100">{gamme.find((p) => p.code === activeProduct)?.name}</h3>
        </div>

        {/* Price field */}
        <label className="block">
          <span className="text-xs font-medium text-slate-400 uppercase">Prix unitaire</span>
          <input
            type="number"
            name={`product.${activeProduct}.price`}
            value={activeProductData.price}
            onChange={(e) => onChange(activeProduct, "price", e.target.value)}
            placeholder="0"
            className="w-full mt-1 bg-transparent border border-slate-700 rounded px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-400/60"
          />
        </label>

        {/* Production plan field */}
        <label className="block">
          <span className="text-xs font-medium text-slate-400 uppercase">Volume de production</span>
          <input
            type="number"
            name={`product.${activeProduct}.productionPlan`}
            value={activeProductData.productionPlan}
            onChange={(e) => onChange(activeProduct, "productionPlan", e.target.value)}
            placeholder="0"
            className="w-full mt-1 bg-transparent border border-slate-700 rounded px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-400/60"
          />
        </label>

        {/* Supplier selection */}
        {suppliers.length > 0 && (
          <label className="block">
            <span className="text-xs font-medium text-slate-400 uppercase">Fournisseur</span>
            <select
              name={`product.${activeProduct}.supplierChoice`}
              value={activeProductData.supplierChoice || ""}
              onChange={(e) => onChange(activeProduct, "supplierChoice", e.target.value)}
              className="w-full mt-1 bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-400/60"
            >
              <option value="">Sélectionner un fournisseur</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        )}

        {/* Margin display */}
        {price > 0 && (
          <div className="bg-slate-800/50 border border-slate-700 rounded px-3 py-2">
            <span className="text-xs font-medium text-slate-400">Marge estimée: </span>
            <span className="text-sm font-semibold text-amber-200">{margin.toFixed(2)}€</span>
          </div>
        )}
      </div>
    </div>
  );
}

interface GammaBudgetsProps {
  gamme: Product[];
  values: Record<string, { marketingBudget?: string; qualityBudget?: string; rdBudget?: string }>;
  onChange: (productCode: string, field: string, value: string) => void;
  hasQualityBudget?: boolean;
  hasRdBudget?: boolean;
}

export function GammaBudgets({
  gamme,
  values,
  onChange,
  hasQualityBudget = false,
  hasRdBudget = false,
}: GammaBudgetsProps) {
  const [activeProduct, setActiveProduct] = useState(gamme[0]?.code ?? "");

  const activeProductData = values[activeProduct] || {
    marketingBudget: "",
    qualityBudget: "",
    rdBudget: "",
  };

  return (
    <div className="space-y-4">
      {/* Product navigation tabs */}
      <div className="flex flex-wrap gap-2">
        {gamme.map((product) => (
          <button
            key={product.code}
            onClick={() => setActiveProduct(product.code)}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition border ${
              activeProduct === product.code
                ? "bg-amber-400/20 border-amber-400/60 text-amber-200"
                : "bg-slate-900 border-white/5 text-slate-400 hover:text-slate-200"
            }`}
          >
            {product.name}
          </button>
        ))}
      </div>

      {/* Budget card */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-4">
        <div>
          <h3 className="text-base font-semibold text-slate-100">{gamme.find((p) => p.code === activeProduct)?.name}</h3>
        </div>

        {/* Responsive grid: 1 column on mobile, 2 on desktop */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Marketing budget */}
          <label className="block sm:col-span-2">
            <span className="text-xs font-medium text-slate-400 uppercase">Budget marketing</span>
            <input
              type="number"
              name={`product.${activeProduct}.marketingBudget`}
              value={activeProductData.marketingBudget || ""}
              onChange={(e) => onChange(activeProduct, "marketingBudget", e.target.value)}
              placeholder="0"
              className="w-full mt-1 bg-transparent border border-slate-700 rounded px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-400/60"
            />
          </label>

          {/* Quality budget - conditional */}
          {hasQualityBudget && (
            <label className="block">
              <span className="text-xs font-medium text-slate-400 uppercase">Budget qualité</span>
              <input
                type="number"
                name={`product.${activeProduct}.qualityBudget`}
                value={activeProductData.qualityBudget || ""}
                onChange={(e) => onChange(activeProduct, "qualityBudget", e.target.value)}
                placeholder="0"
                className="w-full mt-1 bg-transparent border border-slate-700 rounded px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-400/60"
              />
            </label>
          )}

          {/* R&D budget - conditional */}
          {hasRdBudget && (
            <label className={`block ${!hasQualityBudget ? "sm:col-span-2" : ""}`}>
              <span className="text-xs font-medium text-slate-400 uppercase">Budget R&D</span>
              <input
                type="number"
                name={`product.${activeProduct}.rdBudget`}
                value={activeProductData.rdBudget || ""}
                onChange={(e) => onChange(activeProduct, "rdBudget", e.target.value)}
                placeholder="0"
                className="w-full mt-1 bg-transparent border border-slate-700 rounded px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-400/60"
              />
            </label>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Complete decision form for multi-product game rounds.
 * Handles product-specific decisions (price, volume, budgets) with mobile-friendly card layout.
 */
export function DecisionForm({
  gamme,
  suppliers,
  hasQualityBudget,
  hasRdBudget,
  onSubmit,
}: {
  gamme: Product[];
  suppliers?: { id: string; name: string }[];
  hasQualityBudget?: boolean;
  hasRdBudget?: boolean;
  onSubmit?: (data: FormData) => void | Promise<void>;
}) {
  const [values, setValues] = useState<
    Record<string, { price: string; productionPlan: string; supplierChoice?: string; marketingBudget?: string; qualityBudget?: string; rdBudget?: string }>
  >(
    Object.fromEntries(
      gamme.map((p) => [
        p.code,
        {
          price: "",
          productionPlan: "",
          supplierChoice: "",
          marketingBudget: "",
          qualityBudget: "",
          rdBudget: "",
        },
      ]),
    ),
  );

  const handleChange = (productCode: string, field: string, value: string) => {
    setValues((prev) => ({
      ...prev,
      [productCode]: {
        ...prev[productCode],
        [field]: value,
      },
    }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const formData = new FormData();

    // Add all product decisions to FormData with naming convention: product.<code>.<field>
    Object.entries(values).forEach(([productCode, fields]) => {
      if (fields.price) formData.append(`product.${productCode}.price`, fields.price);
      if (fields.productionPlan) formData.append(`product.${productCode}.productionPlan`, fields.productionPlan);
      if (fields.supplierChoice) formData.append(`product.${productCode}.supplierChoice`, fields.supplierChoice);
      if (fields.marketingBudget) formData.append(`product.${productCode}.marketingBudget`, fields.marketingBudget);
      if (fields.qualityBudget) formData.append(`product.${productCode}.qualityBudget`, fields.qualityBudget);
      if (fields.rdBudget) formData.append(`product.${productCode}.rdBudget`, fields.rdBudget);
    });

    if (onSubmit) {
      await onSubmit(formData);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Sales/Pricing Section */}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-slate-100">Tarification & Production</h2>
        <GammeVentes gamme={gamme} values={values} onChange={handleChange} suppliers={suppliers} />
      </section>

      {/* Budgets Section */}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-slate-100">Budgets</h2>
        <GammaBudgets
          gamme={gamme}
          values={values}
          onChange={handleChange}
          hasQualityBudget={hasQualityBudget}
          hasRdBudget={hasRdBudget}
        />
      </section>

      {/* Submit button */}
      <button
        type="submit"
        className="w-full bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold py-2 px-4 rounded-lg transition"
      >
        Valider les décisions
      </button>
    </form>
  );
}
