import { cn } from "@/lib/utils"
import { cva, type VariantProps } from "class-variance-authority"

const tagVariants = cva(
	"inline-flex items-center rounded-sm bg-accent px-2 py-1 text-xs font-medium text-accent-foreground border-1 gap-1",
	{
		variants: {
			variant: {
				default: "",
				success: "bg-green-600/10 text-green-500 border-green-600",
			},
		},
		defaultVariants: {
			variant: "default",
		},
	},
)

export function Tag({
	className,
	variant,
	...props
}: React.ComponentProps<"div"> & VariantProps<typeof tagVariants>) {
	return <div className={cn(tagVariants({ variant }))} {...props} />
}
