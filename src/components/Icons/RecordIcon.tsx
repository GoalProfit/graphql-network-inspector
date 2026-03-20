import { SVGAttributes } from "react"

interface IRecordIconProps extends SVGAttributes<{}> {
  active?: boolean
}

export const RecordIcon = (props: IRecordIconProps) => {
  const { width = "1.5rem", height = "1.5rem", active = false, ...rest } = props
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill={active ? "currentColor" : "none"}
      width={width}
      height={height}
      viewBox="0 0 24 24"
      stroke="currentColor"
      {...rest}
    >
      <circle cx="12" cy="12" r="8" strokeWidth={2} />
    </svg>
  )
}
