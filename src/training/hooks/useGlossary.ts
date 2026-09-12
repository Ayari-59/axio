"use client";

import { useState } from "react";
import { GLOSSARY } from "../glossary";
import { GlossaryEntry } from "../types";

export function useGlossary() {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const entries = Object.values(GLOSSARY);

  const filteredEntries = searchTerm
    ? entries.filter(
        (e) =>
          e.term.toLowerCase().includes(searchTerm.toLowerCase()) ||
          e.definition.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : entries;

  return {
    isOpen,
    setIsOpen,
    searchTerm,
    setSearchTerm,
    entries: filteredEntries,
    allEntries: entries,
  };
}
