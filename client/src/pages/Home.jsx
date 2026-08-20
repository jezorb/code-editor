import Editor from "../components/Editor";
import Output from "../components/Output";
import LanguageSelector from "../components/LanguageSelector";

import { useEffect, useRef, useState } from "react";
import axios from "axios";
import socket from "../socket/socket";
import { Navbar } from "../components/Navbar";

function Home() {
  const [jobId, setJobId] = useState(null);
  const [language, setLanguage] = useState("python");
  const [input, setInput] = useState("");
  const [status, setStatus] = useState("Idle");
  const [output, setOutput] = useState("");

  // Code editor width
  const [editorWidth, setEditorWidth] = useState(52);

  // Input height
  const [inputHeight, setInputHeight] = useState(50);

  const verticalDragging = useRef(false);
  const horizontalDragging = useRef(false);
  const jobIdRef = useRef(null);

  const defaultCode = {
    python: `name = input("Enter your name: ")
print(f"Hello, {name}!")`,

    javascript: `const name = require("fs")
  .readFileSync(0, "utf8")
  .trim();

console.log(\`Hello, \${name}!\`);`,

    cpp: `#include <iostream>
using namespace std;

int main() {
    string name;
    cin >> name;

    cout << "Hello, " << name << "!" << endl;

    return 0;
}`,

    java: `import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);

        String name = sc.nextLine();

        System.out.println("Hello, " + name + "!");
    }
}`,
  };

  const [code, setCode] = useState(defaultCode.python);

  // -----------------------------
  // LANGUAGE CHANGE
  // -----------------------------

  useEffect(() => {
    setCode(defaultCode[language]);
    setInput("");
  }, [language]);

  // -----------------------------
  // SOCKET EVENTS
  // -----------------------------

  useEffect(() => {
    const handleOutput = (data) => {
      if (String(data.jobId) !== String(jobIdRef.current)) {
        return;
      }

      setOutput((prev) => prev + data.output);
    };

    const handleStatus = (data) => {
      if (String(data.jobId) !== String(jobIdRef.current)) {
        return;
      }

      setStatus(data.status);
    };

    socket.on("output", handleOutput);
    socket.on("status", handleStatus);

    return () => {
      socket.off("output", handleOutput);
      socket.off("status", handleStatus);
    };
  }, []);

  // -----------------------------
  // RUN CODE
  // -----------------------------

  const runCode = async () => {
    try {
      setOutput("");
      setStatus("Running...");

      if (jobIdRef.current) {
        socket.emit(
          "leave-job",
          String(jobIdRef.current)
        );
      }

      const newJobId = crypto.randomUUID();

      setJobId(newJobId);
      jobIdRef.current = newJobId;

      // Join room BEFORE creating job
      socket.emit("join-job", newJobId);

      await axios.post(
        "http://localhost:5000/api/execute",
        {
          jobId: newJobId,
          language,
          code,
          input,
        }
      );
    } catch (error) {
      console.error(
        "Execution request failed:",
        error
      );

      setStatus("Execution Failed");

      setOutput(
        error.response?.data?.message ||
          "Failed to start execution"
      );
    }
  };

  // -----------------------------
  // VERTICAL RESIZE
  // -----------------------------

  const startVerticalDrag = (event) => {
    event.preventDefault();

    verticalDragging.current = true;

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  // -----------------------------
  // HORIZONTAL RESIZE
  // -----------------------------

  const startHorizontalDrag = (event) => {
    event.preventDefault();

    horizontalDragging.current = true;

    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";
  };

  // -----------------------------
  // RESIZE HANDLERS
  // -----------------------------

  useEffect(() => {
    const handleMouseMove = (event) => {
      // -----------------------------
      // CODE / RIGHT SIDE
      // -----------------------------

      if (verticalDragging.current) {
        const container =
          document.getElementById(
            "main-workspace"
          );

        if (!container) return;

        const rect =
          container.getBoundingClientRect();

        const percentage =
          ((event.clientX - rect.left) /
            rect.width) *
          100;

        const value = Math.min(
          Math.max(percentage, 30),
          70
        );

        setEditorWidth(value);
      }

      // -----------------------------
      // INPUT / OUTPUT
      // -----------------------------

      if (horizontalDragging.current) {
        const container =
          document.getElementById(
            "right-workspace"
          );

        if (!container) return;

        const rect =
          container.getBoundingClientRect();

        const percentage =
          ((event.clientY - rect.top) /
            rect.height) *
          100;

        const value = Math.min(
          Math.max(percentage, 20),
          80
        );

        setInputHeight(value);
      }
    };

    const handleMouseUp = () => {
      verticalDragging.current = false;
      horizontalDragging.current = false;

      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    window.addEventListener(
      "mousemove",
      handleMouseMove
    );

    window.addEventListener(
      "mouseup",
      handleMouseUp
    );

    return () => {
      window.removeEventListener(
        "mousemove",
        handleMouseMove
      );

      window.removeEventListener(
        "mouseup",
        handleMouseUp
      );
    };
  }, []);

  return (
    <div
      className="
        h-[100dvh]
        w-full
        overflow-hidden
        bg-[#0f0f0f]
        text-zinc-200
        select-none
        flex
        flex-col
      "
    >
      {/* ========================= */}
      {/* NAVBAR */}
      {/* ========================= */}

      <div className="shrink-0">
        <Navbar onRun={runCode} />
      </div>

      {/* ========================= */}
      {/* MAIN WORKSPACE */}
      {/* ========================= */}

      <main
        id="main-workspace"
        className="
          flex
          flex-1
          min-h-0
          min-w-0
          w-full
          overflow-hidden
        "
      >
        {/* ========================= */}
        {/* CODE EDITOR */}
        {/* ========================= */}

        <section
          className="
            h-full
            min-h-0
            min-w-0
            flex
            flex-col
            bg-[#1a1a1a]
          "
          style={{
            width: `${editorWidth}%`,
          }}
        >
          {/* Editor Header */}
          <div
            className="
              h-11
              min-h-11
              shrink-0
              flex
              items-center
              justify-between
              px-3
              bg-[#1f1f1f]
              border-b
              border-[#333]
            "
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-green-500 text-sm shrink-0">
                {"</>"}
              </span>

              <span className="text-sm font-semibold truncate">
                Code
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <LanguageSelector
                language={language}
                setLanguage={setLanguage}
              />
            </div>
          </div>

          {/* Monaco */}
          <div
            className="
              flex-1
              min-h-0
              min-w-0
              overflow-hidden
              select-text
            "
          >
            <Editor
              code={code}
              setCode={setCode}
              language={language}
            />
          </div>
        </section>

        {/* ========================= */}
        {/* VERTICAL DRAGGER */}
        {/* ========================= */}

        <div
          onMouseDown={startVerticalDrag}
          className="
            relative
            w-[5px]
            min-w-[5px]
            shrink-0
            bg-[#282828]
            hover:bg-[#3b82f6]
            cursor-col-resize
            transition-colors
          "
        >
          <div
            className="
              absolute
              top-1/2
              left-1/2
              -translate-x-1/2
              -translate-y-1/2
              h-10
              w-[3px]
              rounded-full
              bg-[#555]
            "
          />
        </div>

        {/* ========================= */}
        {/* RIGHT SIDE */}
        {/* ========================= */}

        <section
          id="right-workspace"
          className="
            flex-1
            min-w-0
            min-h-0
            h-full
            flex
            flex-col
            bg-[#1a1a1a]
            overflow-hidden
          "
        >
          {/* ========================= */}
          {/* INPUT */}
          {/* ========================= */}

          <div
            className="
              min-h-0
              min-w-0
              overflow-hidden
              flex
              flex-col
            "
            style={{
              height: `${inputHeight}%`,
            }}
          >
            {/* Input Header */}
            <div
              className="
                h-11
                min-h-11
                shrink-0
                flex
                items-center
                justify-between
                gap-3
                px-4
                bg-[#1f1f1f]
                border-b
                border-[#333]
              "
            >
              <span
                className="
                  text-sm
                  font-semibold
                  text-zinc-200
                  truncate
                "
              >
                Input
              </span>

              <span
                className="
                  text-xs
                  text-zinc-500
                  whitespace-nowrap
                "
              >
                Standard Input
              </span>
            </div>

            {/* Input */}
            <textarea
              value={input}
              onChange={(e) =>
                setInput(e.target.value)
              }
              placeholder="Enter program input..."
              className="
                block
                flex-1
                min-h-0
                w-full
                resize-none
                bg-[#111111]
                text-zinc-300
                p-4
                outline-none
                border-none
                font-mono
                text-sm
                leading-6
                placeholder:text-zinc-600
                select-text
              "
            />
          </div>

          {/* ========================= */}
          {/* HORIZONTAL DRAGGER */}
          {/* ========================= */}

          <div
            onMouseDown={startHorizontalDrag}
            className="
              relative
              h-[5px]
              min-h-[5px]
              shrink-0
              bg-[#282828]
              hover:bg-[#3b82f6]
              cursor-row-resize
              transition-colors
            "
          >
            <div
              className="
                absolute
                left-1/2
                top-1/2
                -translate-x-1/2
                -translate-y-1/2
                w-10
                h-[3px]
                rounded-full
                bg-[#555]
              "
            />
          </div>

          {/* ========================= */}
          {/* OUTPUT */}
          {/* ========================= */}

          <div
            className="
              flex-1
              min-h-0
              min-w-0
              overflow-hidden
            "
          >
            <Output
              output={output}
              status={status}
            />
          </div>
        </section>
      </main>
    </div>
  );
}

export default Home;