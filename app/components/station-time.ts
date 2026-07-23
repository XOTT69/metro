export function formatTimer(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function formatFollowing(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  return `ще один приблизно за ${minutes} хв`;
}
