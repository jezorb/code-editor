import { useEffect } from "react";
import { FaCode, FaPlay } from "react-icons/fa";
import { Link } from "react-router-dom";

export const Navbar = ({ onRun }) => {
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.ctrlKey && event.key === "Enter") {
        event.preventDefault();
        onRun();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onRun]);

  return (
    <header
      className="
        h-14
        w-full
        shrink-0
        flex
        items-center
        justify-between
        px-4
        bg-[#0f0f0f]
        border-b
        border-[#2b2b2b]
      "
    >
      {/* Left */}
      <div className="flex items-center gap-3">
        <div
          className="
            w-8
            h-8
            rounded-md
            bg-[#2cbb5d]
            flex
            items-center
            justify-center
            text-black
          "
        >
          <FaCode size={15} />
        </div>

        <h1 className="text-sm font-semibold text-zinc-100">
          Code Editor
        </h1>
      </div>

      {/* Right */}
      <div className="relative group">
        <button
          onClick={onRun}
          className="
            flex
            items-center
            gap-2
            px-4
            py-2
            rounded-md
            bg-[#2cbb5d]
            hover:bg-[#26a850]
            hover:scale-[1.02]
            active:scale-95
            cursor-pointer
            text-black
            text-sm
            font-semibold
            transition-all
            duration-150
          "
        >
          <FaPlay size={12} />
          <span>Run Code</span>
        </button>

        {/* Shortcut */}
        <div
          className="
            absolute
            top-full
            right-0
            mt-2
            px-2
            py-1
            rounded
            bg-[#252525]
            border
            border-[#3a3a3a]
            text-zinc-400
            text-[10px]
            whitespace-nowrap
            opacity-0
            invisible
            translate-y-[-4px]
            group-hover:opacity-100
            group-hover:visible
            group-hover:translate-y-0
            transition-all
            duration-150
            pointer-events-none
            z-50
          "
        >
          Ctrl + Enter
        </div>
      </div>
    </header>
  );
};