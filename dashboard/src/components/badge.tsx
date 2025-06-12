import { cn } from "@/lib/utils"
import { cva, type VariantProps } from "class-variance-authority"

const badgeVariants = cva(
	"inline-flex items-center rounded-full bg-accent px-1 py-1 text-xs font-medium text-accent-foreground",
	{
		variants: {
			variant: {
				default: "",
				success: "bg-green-600/50 text-green-50 border-green-500",
			},
		},
	},
)

export function Badge({
	className,
	variant,
	...props
}: React.ComponentProps<"div"> & VariantProps<typeof badgeVariants>) {
	return <div className={cn(badgeVariants({ variant }))} {...props} />
}
