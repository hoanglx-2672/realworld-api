/** Hình dạng `Profile` trong spec (api-response-format.md#profile). */
export interface Profile {
  username: string;
  bio: string | null;
  image: string | null;
  following: boolean;
}
