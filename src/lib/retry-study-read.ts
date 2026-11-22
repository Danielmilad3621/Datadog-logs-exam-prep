/** Retry read-only calls only for transport failures, never permission errors. */
export async function retryStudyRead<T>(read: () => Promise<T>, wait: (ms: number) => Promise<void> = ms => new Promise(resolve => setTimeout(resolve, ms))): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try { return await read(); }
    catch (error) {
      if (!(error instanceof TypeError) || !/failed to fetch|networkerror|load failed/i.test(error.message) || attempt >= 2) throw error;
      await wait(500 * (attempt + 1));
    }
  }
}