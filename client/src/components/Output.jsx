function Output({ output, status }) {
  return (
    <div className="h-full flex flex-col bg-[#1a1a1a]">

      {/* Header */}
      <div className="
        h-11
        shrink-0
        flex
        items-center
        justify-between
        px-4
        bg-[#1f1f1f]
        border-b
        border-[#333]
      ">

        <span className="
          text-sm
          font-semibold
          text-zinc-200
        ">
          Output
        </span>

        <span className={`
          text-xs
          ${
            status === "Running..."
              ? "text-yellow-400"
              : status === "Execution Failed"
              ? "text-red-400"
              : "text-green-400"
          }
        `}>
          {status}
        </span>

      </div>

      {/* Terminal */}
      <div className="
        flex-1
        min-h-0
        overflow-auto
        bg-[#111111]
        p-4
      ">

        {output ? (
          <pre className="
            whitespace-pre-wrap
            break-words
            font-mono
            text-sm
            leading-6
            text-zinc-300
          ">
            {output}
          </pre>
        ) : (
          <div className="
            h-full
            flex
            items-center
            justify-center
            text-sm
            text-zinc-600
          ">
            You must run your code first
          </div>
        )}

      </div>

    </div>
  );
}

export default Output;