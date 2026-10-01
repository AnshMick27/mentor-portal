import ReactMarkdown from "react-markdown";

/**
 * Renders mentor-written markdown safely: raw HTML is dropped (`skipHtml`) and react-markdown's default URL
 * filter removes `javascript:` and similar links. Links open in a new tab without referrer access, and say so to
 * screen readers. Images are not shown: the CSP blocks outside images, so they would only appear broken (UX-29). Headings are
 * shifted down so they fit under the page's "What to do" h2: `#`/`##` become h3, deeper ones h4 (UX-11).
 */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="markdown">
      <ReactMarkdown
        skipHtml
        components={{
          h1: ({ children: text }) => <h3>{text}</h3>,
          h2: ({ children: text }) => <h3>{text}</h3>,
          h3: ({ children: text }) => <h4>{text}</h4>,
          h4: ({ children: text }) => <h4>{text}</h4>,
          h5: ({ children: text }) => <h4>{text}</h4>,
          h6: ({ children: text }) => <h4>{text}</h4>,
          img: ({ alt }) => (
            <span className="text-sm text-muted">
              [Image not shown{alt ? `: ${alt}` : ""}. Ask your mentor for the file.]
            </span>
          ),
          a: ({ href, children: text }) => (
            <a href={href} target="_blank" rel="noopener noreferrer nofollow">
              {text}
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
