import { ArrowLeft, BackpackIcon } from "lucide-react";
import Link from "next/link";

interface TitleProps {
  title: string;
  subTitle?: string;
  backButton?: boolean;
  path?: string;
}

export default function Title({
  title,
  subTitle,
  backButton,
  path
}: TitleProps) {
  return (
    <section className="mt-8 md:mt-0">
      <h1 className="text-3xl font-bold flex gap-x-4 items-center">
        {backButton && path && (
          <Link href={path} className="text-white">
            <ArrowLeft /> 
          </Link>
        )}
        {title}
      </h1>
      <p className="text-gray-400">{subTitle}</p>
    </section>
  );
}
