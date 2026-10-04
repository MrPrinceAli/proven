"use client";

import { IconSearch } from "@proven/ui";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

/** Header box that opens a public profile by its slug ("arya-pratama", "@arya-pratama" or a /p/ link). */
export function ProfileJump() {
  const router = useRouter();
  const [value, setValue] = useState("");

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const slug = value
      .trim()
      .replace(/^.*\/p\//, "")
      .replace(/^@/, "")
      .toLowerCase();
    if (/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(slug)) {
      router.push(`/p/${slug}`);
      setValue("");
    }
  }

  return (
    <form role="search" onSubmit={onSubmit} className="relative hidden max-w-xs flex-1 md:block">
      <label htmlFor="profile-jump" className="sr-only">
        Buka profil publik
      </label>
      <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
      <input
        id="profile-jump"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Buka profil: @arya-pratama"
        className="w-full rounded-full bg-[#EEF3F8] py-1.5 pl-9 pr-3 text-sm placeholder:text-gray-500 focus:bg-white focus:outline focus:outline-2 focus:outline-brand-700"
      />
    </form>
  );
}
