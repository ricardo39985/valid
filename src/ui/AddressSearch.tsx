import { MapPin, Search } from 'lucide-react'
import { useId, useMemo, useState } from 'react'
import { buildAddressIndex, searchAddresses } from '../data'
import type { Address } from '../routing/types'

type Props = {
  index: ReturnType<typeof buildAddressIndex>
  disabled: boolean
  onChoose: (address: Address) => void
}

export default function AddressSearch({ index, disabled, onChoose }: Props) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const listId = useId()
  const suggestions = useMemo(() => searchAddresses(index, query), [index, query])
  const visible = open && query.trim().length >= 2

  function choose(address: Address) {
    setQuery('')
    setOpen(false)
    setActive(-1)
    onChoose(address)
  }

  return <div className="address-search">
    <div className="search-field">
      <Search size={20} aria-hidden="true" />
      <input aria-label="San Francisco street address" placeholder="Enter a San Francisco address"
        autoComplete="off" value={query} disabled={disabled} role="combobox"
        aria-autocomplete="list" aria-expanded={visible && suggestions.length > 0} aria-controls={listId}
        aria-activedescendant={visible && active >= 0 ? `${listId}-${active}` : undefined}
        onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}
        onChange={event => { setQuery(event.target.value); setOpen(true); setActive(-1) }}
        onKeyDown={event => {
          if (event.key === 'Escape') { setOpen(false); setActive(-1); return }
          if (!suggestions.length) return
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            setOpen(true)
            setActive(value => event.key === 'ArrowDown'
              ? (value + 1) % suggestions.length
              : (value <= 0 ? suggestions.length - 1 : value - 1))
          } else if (event.key === 'Enter' && visible) {
            event.preventDefault()
            choose(suggestions[Math.max(0, active)])
          }
        }} />
    </div>
    {visible && <div className="search-popover">
      {suggestions.length ? <div id={listId} role="listbox" aria-label="Matching addresses">
        {suggestions.map((address, i) => <button key={address[0] + address[4]} id={`${listId}-${i}`}
          role="option" tabIndex={-1} aria-selected={active === i}
          onMouseDown={event => event.preventDefault()} onClick={() => choose(address)}>
          <MapPin size={16} aria-hidden="true" />
          <span>{address[0]} <small>San Francisco{address[4] && `, ${address[4]}`}</small></span>
        </button>)}
      </div> : <p role="status">No matching address. Try the street number and name.</p>}
    </div>}
  </div>
}
