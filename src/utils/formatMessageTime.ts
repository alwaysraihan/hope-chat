const formatMessageTime = (date: Date | number): string => {
  const d = new Date(date);
  const diffH = (Date.now() - d.getTime()) / 3_600_000;
  if (diffH < 24)
    return d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  if (diffH < 48) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export default formatMessageTime;
