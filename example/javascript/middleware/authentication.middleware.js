export default ({ response }) => {
  response.setStatus(401);
  return {
    success: false,
    message: 'Hello, World!',
  };
};
