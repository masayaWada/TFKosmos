import axios, { AxiosError } from 'axios'

const apiClient = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
})

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    // Handle API error responses
    if (error.response?.data) {
      const errorData = error.response.data as any
      if (errorData.error) {
        // Custom error format from backend
        const customError = new Error(errorData.error.message || 'An error occurred')
        ;(customError as any).code = errorData.error.code
        ;(customError as any).details = errorData.error.details
        return Promise.reject(customError)
      }
    }
    return Promise.reject(error)
  }
)

export default apiClient

