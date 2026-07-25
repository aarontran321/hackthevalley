export async function apiPost<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error?.message || "Something went wrong. Please try again.");
  return data as T;
}

export async function imageToDataUrl(file: File) {
  if (file.size > 7_000_000) throw new Error("Please choose an image smaller than 7 MB.");
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("Please choose a JPEG, PNG, or WebP image.");
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("We couldn’t read that image."));
    reader.readAsDataURL(file);
  });
}
