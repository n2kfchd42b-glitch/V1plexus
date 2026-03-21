"use client"

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { Shield, Upload, CheckCircle, AlertCircle, ExternalLink, Copy, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'

type SsoStatus = 'not_configured' | 'configured' | 'error'

export default function SsoConfigPage() {
  const [idpMetadataUrl, setIdpMetadataUrl] = useState('')
  const [idpMetadataXml, setIdpMetadataXml] = useState('')
  const [inputMode, setInputMode] = useState<'url' | 'xml'>('url')
  const [status, setStatus] = useState<SsoStatus>('not_configured')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [copied, setCopied] = useState(false)

  // These would come from the institution configuration in a real implementation
  const entityId = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/sso/saml`
  const acsUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/sso/saml/acs`

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSave = async () => {
    const input = inputMode === 'url' ? idpMetadataUrl : idpMetadataXml
    if (!input.trim()) {
      setError('Please provide IdP metadata URL or XML.')
      return
    }
    setLoading(true)
    setError('')
    setSuccess('')

    // In production, this would call a server action or API to configure
    // the SAML connection via Supabase Management API or your backend.
    // Here we simulate the save action.
    try {
      await new Promise(resolve => setTimeout(resolve, 1500))
      setStatus('configured')
      setSuccess('SSO configuration saved. Users from your institution can now sign in with SSO.')
    } catch {
      setStatus('error')
      setError('Failed to save SSO configuration. Please check your metadata and try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleRemove = async () => {
    setLoading(true)
    await new Promise(resolve => setTimeout(resolve, 800))
    setStatus('not_configured')
    setIdpMetadataUrl('')
    setIdpMetadataXml('')
    setSuccess('')
    setError('')
    setLoading(false)
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Shield className="h-5 w-5 text-blue-600" />
          <h1 className="text-2xl font-bold">SSO Configuration</h1>
        </div>
        <p className="text-muted-foreground text-sm">
          Configure SAML 2.0 Single Sign-On for your institution. Users with matching email domains
          will be able to authenticate via your Identity Provider.
        </p>
      </div>

      {/* Status */}
      <div className="flex items-center gap-3 mb-6">
        <span className="text-sm font-medium text-muted-foreground">Status:</span>
        {status === 'not_configured' && (
          <Badge variant="outline" className="text-gray-600 border-gray-200">Not configured</Badge>
        )}
        {status === 'configured' && (
          <Badge className="text-green-700 bg-green-50 border border-green-200">
            <CheckCircle className="h-3.5 w-3.5 mr-1" />
            Active
          </Badge>
        )}
        {status === 'error' && (
          <Badge className="text-red-700 bg-red-50 border border-red-200">
            <AlertCircle className="h-3.5 w-3.5 mr-1" />
            Configuration error
          </Badge>
        )}
      </div>

      {/* Service Provider Info */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Service Provider Details</CardTitle>
          <CardDescription>
            Provide these values to your Identity Provider (IdP) when setting up the SAML connection.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">Entity ID / Issuer</Label>
            <div className="flex items-center gap-2 mt-1">
              <code className="flex-1 text-xs bg-muted px-3 py-2 rounded font-mono break-all">
                {entityId}
              </code>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => handleCopy(entityId)}
              >
                {copied ? <CheckCircle className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">ACS URL (Reply URL)</Label>
            <div className="flex items-center gap-2 mt-1">
              <code className="flex-1 text-xs bg-muted px-3 py-2 rounded font-mono break-all">
                {acsUrl}
              </code>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => handleCopy(acsUrl)}
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
            <a
              href="https://supabase.com/docs/guides/auth/enterprise-sso/auth-sso-saml"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 hover:underline"
            >
              View Supabase SAML SSO documentation
            </a>
          </div>
        </CardContent>
      </Card>

      {/* IdP Configuration */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Identity Provider Configuration</CardTitle>
          <CardDescription>
            Provide your IdP metadata from your SAML Identity Provider (e.g. Okta, Azure AD, Google Workspace).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex border rounded-lg overflow-hidden mb-4">
            <button
              onClick={() => setInputMode('url')}
              className={`flex-1 text-sm py-2 transition-colors ${inputMode === 'url' ? 'bg-blue-600 text-white' : 'hover:bg-muted'}`}
            >
              Metadata URL
            </button>
            <button
              onClick={() => setInputMode('xml')}
              className={`flex-1 text-sm py-2 transition-colors ${inputMode === 'xml' ? 'bg-blue-600 text-white' : 'hover:bg-muted'}`}
            >
              Upload XML
            </button>
          </div>

          {inputMode === 'url' ? (
            <div>
              <Label>IdP Metadata URL</Label>
              <Input
                className="mt-1 font-mono text-sm"
                placeholder="https://your-idp.example.com/metadata"
                value={idpMetadataUrl}
                onChange={e => setIdpMetadataUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1.5">
                PLEXUS will automatically fetch and refresh the metadata from this URL.
              </p>
            </div>
          ) : (
            <div>
              <Label>IdP Metadata XML</Label>
              <Textarea
                className="mt-1 font-mono text-xs"
                placeholder='<?xml version="1.0"?><EntityDescriptor ...>...</EntityDescriptor>'
                value={idpMetadataXml}
                onChange={e => setIdpMetadataXml(e.target.value)}
                rows={8}
              />
              <div className="mt-2">
                <label className="flex items-center gap-2 border rounded px-3 py-2 cursor-pointer hover:bg-muted/50 text-sm text-muted-foreground w-fit">
                  <Upload className="h-4 w-4" />
                  Upload metadata file
                  <input
                    type="file"
                    accept=".xml"
                    className="hidden"
                    onChange={async e => {
                      const file = e.target.files?.[0]
                      if (file) {
                        const text = await file.text()
                        setIdpMetadataXml(text)
                      }
                    }}
                  />
                </label>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Domain Mapping */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Domain Mapping</CardTitle>
          <CardDescription>
            Users with these email domains will be automatically redirected to SSO.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div>
            <Label>Email domains</Label>
            <Input
              className="mt-1"
              placeholder="university.edu, hospital.org"
            />
            <p className="text-xs text-muted-foreground mt-1.5">
              Separate multiple domains with commas.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Messages */}
      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg mb-4 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          {error}
        </div>
      )}
      {success && (
        <div className="flex items-start gap-2 p-3 bg-green-50 border border-green-200 rounded-lg mb-4 text-sm text-green-700">
          <CheckCircle className="h-4 w-4 mt-0.5 shrink-0" />
          {success}
        </div>
      )}

      <Separator className="my-6" />

      <div className="flex items-center justify-between">
        {status === 'configured' && (
          <Button variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={handleRemove} disabled={loading}>
            Remove SSO
          </Button>
        )}
        <div className="ml-auto flex gap-3">
          <Button variant="outline" onClick={() => { setIdpMetadataUrl(''); setIdpMetadataXml(''); setError('') }}>
            Reset
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? 'Saving...' : 'Save Configuration'}
            <ChevronRight className="ml-1.5 h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Supported Providers */}
      <div className="mt-8">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Supported Identity Providers
        </p>
        <div className="flex flex-wrap gap-2">
          {['Okta', 'Azure AD', 'Google Workspace', 'ADFS', 'OneLogin', 'Ping Identity', 'Shibboleth'].map(p => (
            <Badge key={p} variant="outline" className="text-xs">{p}</Badge>
          ))}
        </div>
      </div>
    </div>
  )
}
