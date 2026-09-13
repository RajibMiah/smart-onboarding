import type { ComponentPropsWithoutRef } from "react";

import { cn } from "@/lib/utils";

/** Compound `Card` — `<Card><Card.Header/><Card.Body/><Card.Footer/></Card>`. */
const Card = ({ className, children, ...props }: ComponentPropsWithoutRef<"div">) => {
  return (
    <div
      className={cn(
        "rounded-none border-2 border-black bg-white shadow-card",
        className ?? "",
      )}
      {...props}
    >
      {children}
    </div>
  );
};

const CardHeader = ({ className, children, ...props }: ComponentPropsWithoutRef<"div">) => {
  return (
    <div
      className={cn("flex items-center justify-between gap-3 px-4 pt-4", className ?? "")}
      {...props}
    >
      {children}
    </div>
  );
};

const CardBody = ({ className, children, ...props }: ComponentPropsWithoutRef<"div">) => {
  return (
    <div className={cn("p-4", className ?? "")} {...props}>
      {children}
    </div>
  );
};

const CardFooter = ({ className, children, ...props }: ComponentPropsWithoutRef<"div">) => {
  return (
    <div
      className={cn("flex items-center gap-2 border-t-2 border-black px-4 py-3", className ?? "")}
      {...props}
    >
      {children}
    </div>
  );
};

Card.Header = CardHeader;
Card.Body = CardBody;
Card.Footer = CardFooter;

export { Card };
