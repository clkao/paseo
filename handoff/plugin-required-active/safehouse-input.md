# Input from the paseo-safehouse manager (2026-11-21)

For task `plugin-required-active`. Ideation must read this.

**Host support must be visible at create time.** The `agent.create.before` result schema is strict. A plugin that returns `requirePlugin: true` to a host without the feature makes creation fail. So a plugin needs a create-time signal of support.

**The proposed signal.** On a host with the feature, the `agent.create.before` request carries `requirePlugin: false`. The plugin sets it to `true`. Any equivalent create-time signal is acceptable.

**How Safehouse uses it.** Safehouse offers the wrap route only when both are true:
- the provider reports `launchWrap`;
- the host offers the requirement.

So until this task lands, Safehouse does not wrap any provider, even with `launch-wrap-hook` merged.
