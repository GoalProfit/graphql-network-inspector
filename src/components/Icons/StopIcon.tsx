import { SVGAttributes } from "react"

interface IStopIconProps extends SVGAttributes<{}> {}

export const StopIcon = (props: IStopIconProps) => {
  const { width = "1.5rem", height = "1.5rem", ...rest } = props
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="currentColor"
      width={width}
      height={height}
      viewBox="0 0 24 24"
      stroke="currentColor"
      {...rest}
    >
      <rect x="6" y="6" width="12" height="12" rx="1" strokeWidth={2} />
    </svg>
  )
}
