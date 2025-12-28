import React from 'react'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught', error, info)
  }

  handleRetry = () => {
    this.setState({ error: null })
  }

  handleRefresh = () => {
    window.location.reload()
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 20, fontFamily: 'Segoe UI, Arial', textAlign: 'center' }}>
          <h2 style={{ color: '#b00020' }}>Something went wrong</h2>
          <p>This often happens during hot-reload. Try refreshing the page.</p>
          <button 
            onClick={this.handleRefresh}
            style={{ padding: '10px 20px', fontSize: 16, cursor: 'pointer', marginRight: 10 }}
          >
            Refresh Page
          </button>
          <button 
            onClick={this.handleRetry}
            style={{ padding: '10px 20px', fontSize: 16, cursor: 'pointer' }}
          >
            Retry
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

