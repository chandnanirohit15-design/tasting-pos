"use client";
import * as React from "react";

export function SimpleCourseEditor({
  value,
  onChange,
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  const ref = React.useRef<HTMLTextAreaElement | null>(null);

  React.useEffect(() => {
    if (!ref.current) return;
    ref.current.style.height = "0px";
    ref.current.style.height = `${ref.current.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={
        "w-full resize-none rounded-xl border border-zinc-800 bg-black/60 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/80 font-semibold leading-5 " +
        className
      }
      placeholder={"e.g.\n3x Amuse\nS1 feijoa"}
    />
  );
}
