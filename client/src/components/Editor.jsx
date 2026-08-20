import MonacoEditor from "@monaco-editor/react";

function Editor({
  code,
  setCode,
  language,
}) {
  return (
    <div className="w-full h-full">
      <MonacoEditor
        height="100%"
        theme="vs-dark"
        language={language}
        value={code}
        onChange={(value) => setCode(value || "")}
        options={{
          automaticLayout: true,

          fontSize: 14,

          minimap: {
            enabled: false,
          },

          padding: {
            top: 12,
          },

          scrollBeyondLastLine: false,

          smoothScrolling: true,

          cursorBlinking: "smooth",

          renderLineHighlight: "line",

          scrollbar: {
            verticalScrollbarSize: 8,
            horizontalScrollbarSize: 8,
          },
        }}
      />
    </div>
  );
}

export default Editor;