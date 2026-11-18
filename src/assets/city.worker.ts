import { loadCity } from './loadAssets'

void loadCity().then(
  city => self.postMessage({ city }),
  error => self.postMessage({ error: String(error) }),
)
