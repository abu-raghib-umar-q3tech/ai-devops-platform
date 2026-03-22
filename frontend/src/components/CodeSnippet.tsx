import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

type CodeSnippetProps = {
  text: string;
  maxHeightClassName?: string;
};

export function CodeSnippet({
  text,
  maxHeightClassName = "max-h-40",
}: Readonly<CodeSnippetProps>) {
  return (
    <div className={`overflow-auto rounded-md border border-slate-700 ${maxHeightClassName}`}>
      <SyntaxHighlighter
        language="log"
        style={oneDark}
        customStyle={{
          margin: 0,
          background: "#0f172a",
          fontSize: "0.8rem",
          lineHeight: "1.4",
        }}
        wrapLongLines
      >
        {text}
      </SyntaxHighlighter>
    </div>
  );
}

