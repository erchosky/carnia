import type { ImgHTMLAttributes } from "react";

/**
 * Imagen remota cuyo host procede del contenido o del perfil del usuario.
 * No se puede mantener una allowlist fiable para next/image sin conocer esos hosts.
 */
type ExternalImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "alt"> & {
  alt: string;
};

export function ExternalImage(props: ExternalImageProps) {
  const { alt, ...imageProps } = props;
  // eslint-disable-next-line @next/next/no-img-element -- URL externa dinámica, no optimizable con una allowlist segura.
  return <img alt={alt} {...imageProps} />;
}
