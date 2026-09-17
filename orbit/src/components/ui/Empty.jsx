/** "Nothing yet" plus the action that fixes it. Never made-up content. */
export default function Empty({ children = 'Nothing yet.', action }) {
  return (
    <div className="empty">
      <p>{children}</p>
      {action}
    </div>
  )
}
