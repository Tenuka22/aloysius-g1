import { Item, ItemContent, ItemMedia } from "@aloysius-g1/ui/components/item"
import { Skeleton } from "@aloysius-g1/ui/components/skeleton"

export function AuthorizedApplicationSkeleton() {
  return (
    <Item>
      <ItemMedia>
        <Skeleton className="size-10 shrink-0 rounded-md" />
      </ItemMedia>
      <ItemContent>
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-40" />

        <div className="flex gap-1.5">
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-5 w-24 rounded-full" />
        </div>
      </ItemContent>
    </Item>
  )
}
