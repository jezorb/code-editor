import { useState } from "react";
import {
  FaPython,
  FaJs,
  FaJava,
} from "react-icons/fa";
import { SiCplusplus } from "react-icons/si";
import { FiChevronDown } from "react-icons/fi";

function LanguageSelector({ language, setLanguage }) {
  const [open, setOpen] = useState(false);

  const languages = [
    {
      value: "python",
      label: "Python",
      icon: <FaPython />,
    },
    {
      value: "javascript",
      label: "JavaScript",
      icon: <FaJs />,
    },
    {
      value: "cpp",
      label: "C++",
      icon: <SiCplusplus />,
    },
    {
      value: "java",
      label: "Java",
      icon: <FaJava />,
    },
  ];

  const selectedLanguage = languages.find(
    (item) => item.value === language
  );

  const handleSelect = (value) => {
    setLanguage(value);
    setOpen(false);
  };

  return (
    <div className="relative w-40">
      {/* Selected language */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="
          w-full
          flex
          items-center
          justify-between
          gap-2
          px-3
          py-2
          bg-[#282828]
          border
          border-[#3a3a3a]
          hover:border-[#555]
          rounded-md
          text-sm
          text-zinc-200
          cursor-pointer
          transition
        "
      >
        <div className="flex items-center gap-2">
          <span className="text-base text-zinc-300">
            {selectedLanguage.icon}
          </span>

          <span>
            {selectedLanguage.label}
          </span>
        </div>

        <FiChevronDown
          className={`
            text-zinc-500
            transition-transform
            ${open ? "rotate-180" : ""}
          `}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="
            absolute
            top-full
            left-0
            right-0
            mt-1
            z-50
            overflow-hidden
            bg-[#282828]
            border
            border-[#3a3a3a]
            rounded-md
            shadow-xl
          "
        >
          {languages.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => handleSelect(item.value)}
              className={`
                w-full
                flex
                items-center
                gap-3
                px-3
                py-2
                text-sm
                text-left
                cursor-pointer
                transition
                ${
                  language === item.value
                    ? "bg-[#333] text-white"
                    : "text-zinc-300 hover:bg-[#333]"
                }
              `}
            >
              <span className="text-base">
                {item.icon}
              </span>

              <span>
                {item.label}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default LanguageSelector;