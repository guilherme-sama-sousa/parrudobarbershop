'use client'

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { bahiaDateFormatter, currencyFormatter, toLocalDateInput } from '@/lib/format'
import { getErrorMessage } from '@/lib/error-message'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import type { Barber, ProductSale, StockBalance } from '@/lib/types'

interface SalesModalProps {
  stock: StockBalance[]
  barbers: Barber[]
  sales: ProductSale[]
  salesReady: boolean
  onClose: () => void
  onSaved: () => Promise<void>
  setError: (value: string) => void
}

export function SalesModal({ stock, barbers, sales, salesReady, onClose, onSaved, setError }: SalesModalProps) {
  const [productId, setProductId] = useState('')
  const [barberId, setBarberId] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [soldOn, setSoldOn] = useState(toLocalDateInput())
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState('')
  const productSelectRef = useRef<HTMLSelectElement>(null)

  const availableProducts = useMemo(() => stock.filter((item) => item.active), [stock])
  const sellableProducts = useMemo(() => availableProducts.filter((item) => item.current_stock > 0 && Number(item.sale_price) > 0), [availableProducts])
  const selectedProduct = availableProducts.find((item) => item.id === productId)
  const numericQuantity = Number(quantity)
  const total = selectedProduct && Number.isFinite(numericQuantity) ? Number(selectedProduct.sale_price) * numericQuantity : 0

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', closeOnEscape)
    window.setTimeout(() => productSelectRef.current?.focus(), 0)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', closeOnEscape)
      previousFocus?.focus()
    }
  }, [onClose])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!selectedProduct) return setError('Selecione o produto vendido.')
    if (!barberId) return setError('Selecione o barbeiro responsável pela venda.')
    if (!Number.isInteger(numericQuantity) || numericQuantity <= 0) return setError('Informe uma quantidade inteira maior que zero.')
    if (numericQuantity > selectedProduct.current_stock) return setError(`Estoque disponível: ${selectedProduct.current_stock} ${selectedProduct.unit}.`)
    if (Number(selectedProduct.sale_price) <= 0) return setError('Cadastre um preço de venda maior que zero para o produto.')
    setSaving(true)
    setError('')
    try {
      const supabase = getSupabaseBrowserClient()
      const { error } = await supabase.rpc('record_product_sale', {
        p_product_id: selectedProduct.id,
        p_barber_id: barberId,
        p_quantity: numericQuantity,
        p_sold_on: soldOn,
      })
      if (error) throw error
      setQuantity('1')
      await onSaved()
    } catch (caught) {
      setError(getErrorMessage(caught, 'Não foi possível registrar a venda.'))
    } finally {
      setSaving(false)
    }
  }

  const removeSale = async (sale: ProductSale) => {
    const productName = sale.stock_products?.name || 'produto'
    if (!window.confirm(`Excluir a venda de ${productName}? O estoque será devolvido e a entrada será removida do caixa.`)) return
    setDeletingId(sale.id)
    setError('')
    try {
      const supabase = getSupabaseBrowserClient()
      const { error } = await supabase.rpc('delete_product_sale', { p_sale_id: sale.id })
      if (error) throw error
      await onSaved()
    } catch (caught) {
      setError(getErrorMessage(caught, 'Não foi possível excluir a venda.'))
    } finally {
      setDeletingId('')
    }
  }

  return <div className="sales-modal-overlay" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose() }}>
    <section className="sales-modal" role="dialog" aria-modal="true" aria-labelledby="sales-modal-title" aria-describedby="sales-modal-description">
      <header className="sales-modal-header"><div><span className="eyebrow">VENDA DE PRODUTO</span><h2 id="sales-modal-title">Lançar venda</h2><p id="sales-modal-description">Baixa o estoque e adiciona a entrada no caixa automaticamente.</p></div><button type="button" className="sales-modal-close" onClick={onClose} aria-label="Fechar modal de venda">×</button></header>
      {!salesReady ? <div className="finance-migration-notice"><strong>Vendas ainda não habilitadas.</strong><span>Execute a migração 006_vendas_e_baixas_automaticas.sql no Supabase.</span></div> : <>
        <div className="sales-modal-layout">
          <form className="admin-form sales-form" onSubmit={submit}>
            <label>Produto<select ref={productSelectRef} value={productId} onChange={(event) => { setProductId(event.target.value); setQuantity('1') }} required><option value="">Selecione o produto</option>{availableProducts.map((item) => { const unavailableReason = item.current_stock <= 0 ? 'sem estoque' : Number(item.sale_price) <= 0 ? 'sem preço' : `${item.current_stock} ${item.unit}`; return <option key={item.id} value={item.id} disabled={item.current_stock <= 0 || Number(item.sale_price) <= 0}>{item.name} — {unavailableReason}</option> })}</select></label>
            <div className="form-grid"><label>Quantidade<input type="number" min="1" max={selectedProduct?.current_stock || undefined} step="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} required /></label><label>Data da venda<input type="date" value={soldOn} onChange={(event) => setSoldOn(event.target.value)} required /></label></div>
            <label>Barbeiro responsável<select value={barberId} onChange={(event) => setBarberId(event.target.value)} required><option value="">Selecione o barbeiro</option>{barbers.filter((item) => item.active).map((barber) => <option key={barber.id} value={barber.id}>{barber.name}</option>)}</select><small>A receita aparecerá no faturamento deste barbeiro.</small></label>
            <div className="sale-total-card"><div><span>Preço unitário</span><strong>{selectedProduct ? currencyFormatter.format(Number(selectedProduct.sale_price)) : '—'}</strong></div><div><span>Estoque disponível</span><strong>{selectedProduct ? `${selectedProduct.current_stock} ${selectedProduct.unit}` : '—'}</strong></div><div className="total"><span>Total da venda</span><strong>{currencyFormatter.format(Math.max(total, 0))}</strong></div></div>
            <button className="button button-gold" type="submit" disabled={saving || !sellableProducts.length || !barbers.some((item) => item.active)}>{saving ? 'Registrando...' : 'Confirmar venda'}</button>
            {!sellableProducts.length && <p className="form-warning">Cadastre o preço e adicione estoque a um produto ativo antes de lançar vendas.</p>}
            {!barbers.some((item) => item.active) && <p className="form-warning">Cadastre ou ative um barbeiro antes de lançar vendas.</p>}
          </form>
          <aside className="recent-sales"><div><span className="eyebrow">ÚLTIMAS VENDAS</span><h3>Histórico recente</h3></div>{sales.slice(0, 8).map((sale) => <article key={sale.id}><div><strong>{sale.stock_products?.name || 'Produto removido'} × {sale.quantity}</strong><span>{sale.barbers?.name || 'Sem barbeiro'} • {bahiaDateFormatter.format(new Date(`${sale.sold_on}T12:00:00-03:00`))}</span></div><div><strong>{currencyFormatter.format(Number(sale.total_amount))}</strong><button type="button" onClick={() => void removeSale(sale)} disabled={deletingId === sale.id}>{deletingId === sale.id ? 'Excluindo...' : 'Excluir'}</button></div></article>)}{!sales.length && <div className="empty-state">Nenhuma venda registrada.</div>}</aside>
        </div>
      </>}
    </section>
  </div>
}
