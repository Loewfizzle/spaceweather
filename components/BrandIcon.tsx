import Image from "next/image";

export function BrandIcon() {
  return (
    <Image
      src="/logo.jpg"
      alt="SkyGlow"
      width={40}
      height={40}
      className="rounded-full flex-shrink-0"
      priority
    />
  );
}
