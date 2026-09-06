import re

with open('src/components/ui/chart.tsx', 'r') as f:
    content = f.read()

# 1. Replace ChartContainer function
old_container = r'''function ChartContainer\(\{
  id,
  className,
  children,
  config,
  \.\.\.props
\}: React\.ComponentProps<"div"> \& \{
  config: ChartConfig
  children: React\.ComponentProps<
    typeof RechartsPrimitive\.ResponsiveContainer
  >\["children"\]
\}\) \{
  const uniqueId = React\.useId\(\)
  const chartId = `chart-\${id \|\| uniqueId\.replace\(/:/g, ""\)}`

  return \(
    <ChartContext\.Provider value=\{\{ config \}\}>
      <div
        data-slot="chart"
        data-chart=\{chartId\}
        className=\{cn\(
          "\[&_.recharts-cartesian-axis-tick_text\]:fill-muted-foreground \[&_.recharts-cartesian-grid_line\[stroke='#ccc'\]\]:stroke-border/50 \[&_.recharts-curve\.recharts-tooltip-cursor\]:stroke-border \[&_.recharts-polar-grid_\[stroke='#ccc'\]\]:stroke-border \[&_.recharts-radial-bar-background-sector\]:fill-muted \[&_.recharts-rectangle\.recharts-tooltip-cursor\]:fill-muted \[&_.recharts-reference-line_\[stroke='#ccc'\]\]:stroke-border flex aspect-video justify-center text-xs \[&_.recharts-dot\[stroke='#fff'\]\]:stroke-transparent \[&_.recharts-layer\]:outline-hidden \[&_.recharts-sector\]:outline-hidden \[&_.recharts-sector\[stroke='#fff'\]\]:stroke-transparent \[&_.recharts-surface\]:outline-hidden",
          className
        \)}
        \{\.\.\.props\}
      >
        <ChartStyle id=\{chartId\} config=\{config\} />
        <RechartsPrimitive\.ResponsiveContainer>
          \{children\}
        </RechartsPrimitive\.ResponsiveContainer>
      </div>
    </ChartContext\.Provider>
  \)
\}'''

new_container = '''function ChartContainer({
  id,
  className,
  children,
  config,
  ...props
}: React.ComponentProps<"div"> & {
  config: ChartConfig
  children: React.ComponentProps<
    typeof RechartsPrimitive.ResponsiveContainer
  >["children"]
}) {
  const uniqueId = React.useId()
  const chartId = `chart-${id || uniqueId.replace(/:/g, "")}`

  // Build inline CSS variables from config (replaces injected <style> tag)
  const chartStyle: React.CSSProperties = {}
  let hasVars = false
  for (const [key, itemConfig] of Object.entries(config)) {
    if (!("color" in itemConfig || "theme" in itemConfig)) continue
    const color =
      (itemConfig as { theme?: Partial<Record<keyof typeof THEMES, string>> })
        .theme?.dark ||
      (itemConfig as { theme?: Partial<Record<keyof typeof THEMES, string>> })
        .theme?.light ||
      (itemConfig as { color?: string }).color
    if (color) {
      chartStyle[`--color-${key}` as any] = color
      hasVars = true
    }
  }

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-slot="chart"
        data-chart={chartId}
        className={cn(
          "[&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-border/50 [&_.recharts-curve.recharts-tooltip-cursor]:stroke-border [&_.recharts-polar-grid_[stroke='#ccc']]:stroke-border [&_.recharts-radial-bar-background-sector]:fill-muted [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted [&_.recharts-reference-line_[stroke='#ccc']]:stroke-border flex aspect-video justify-center text-xs [&_.recharts-dot[stroke='#fff']]:stroke-transparent [&_.recharts-layer]:outline-hidden [&_.recharts-sector]:outline-hidden [&_.recharts-sector[stroke='#fff']]:stroke-transparent [&_.recharts-surface]:outline-hidden",
          className
        )}
        style={hasVars ? chartStyle : undefined}
        {...props}
      >
        <RechartsPrimitive.ResponsiveContainer>
          {children}
        </RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  )
}'''

content = re.sub(old_container, new_container, content, flags=re.DOTALL)

# 2. Remove ChartStyle component
old_style = r'''const ChartStyle = \(\{ id, config \}: \{ id: string; config: ChartConfig \}\) => \{
  const colorConfig = Object\.entries\(config\)\.filter\(
    \(\[, config\]\) => config\.theme \|\| config\.color
  \)

  if \(!colorConfig\.length\) \{
    return null
  \}

  return \(
    <style
      dangerouslySetInnerHTML=\{\{
        __html: Object\.entries\(THEMES\)
          \.map\(
            \(\[theme, prefix\]\) => \`
\${prefix} \[data-chart=\${id}\] \{
\${colorConfig
  \.map\(\(\[key, itemConfig\]\) => \{
    const color =
      itemConfig\.theme\?\.\[theme as keyof typeof itemConfig\.theme\] \|\|
      itemConfig\.color
    return color ? \`  --color-\${key}: \${color};\` : null
  \})
  \.join\("\n"\)
\}
\`
          \)
          \.join\("\n"),
      \}\}
    />
  \)
\}'''

content = re.sub(old_style, '', content, flags=re.DOTALL)

# 3. Fix export
content = content.replace(
    '''export {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  ChartStyle,
}''',
    '''export {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
}'''
)

# 4. Fix helper function name
content = content.replace('getPayloadConfigFromPayload', 'getConfigFromPayload')

with open('src/components/ui/chart.tsx', 'w', newline='\n') as f:
    f.write(content)

print("DONE")
