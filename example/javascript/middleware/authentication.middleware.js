import { HttpStatusCode } from 'yinzerflow';

export default ({ response }) => {
  response.setStatus(HttpStatusCode.UNAUTHORIZED);
  return {
    success: false,
    message: 'Hello, World!',
  };
};
