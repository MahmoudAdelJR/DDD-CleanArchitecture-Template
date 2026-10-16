import { HttpContextToken } from '@angular/common/http';

/** Do not attach the bearer token to this request. */
export const SKIP_AUTH = new HttpContextToken<boolean>(() => false);

/** Do not count this request toward the global loading indicator. */
export const SKIP_LOADING = new HttpContextToken<boolean>(() => false);

/** Do not raise a global error notification for a failed request. */
export const SUPPRESS_GLOBAL_ERROR = new HttpContextToken<boolean>(() => false);
