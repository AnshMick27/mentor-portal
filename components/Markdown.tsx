import ReactMarkdown from "react-markdown";

/**
 * Renders mentor-written markdown safely: raw HTML is dropped (`skipHtml`) and react-markdown's default URL
 * filter removes `javascript:` and similar links. Links open in a new tab without referrer access.
 */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="markdown">
      <ReactMarkdown
        skipHtml
        components={{
          a: ({ href, children: text }) => (
            <a href={href} target="_blank" rel="noopener noreferrer nofollow">
              {text}
            </a>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
