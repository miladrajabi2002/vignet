/**
 * A template re-mounts on every navigation between the agent's tabs, so the
 * tab body cross-fades in instead of snapping. The header and tab bar live in
 * the layout above and stay put.
 */
export default function AgentTabTemplate({ children }: { children: React.ReactNode }) {
  return <div className="agent-tab-fade">{children}</div>
}
