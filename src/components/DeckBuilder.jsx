/**
 * DeckBuilder Component
 * Main interface for creating and managing Magic: The Gathering decks
 * Handles deck creation, card search, commander selection, and deck statistics
 */
import { useState, useEffect } from 'react'
import { useDeck } from '../context/DeckContext'
import { useCollection } from '../context/CollectionContext'
import styles from '../styles/DeckBuilder.module.css'
import DeckStats from './DeckStats'
import popupStyles from '../styles/CardPopup.module.css'
import DeckTester from './DeckTester'
import { useAuth } from '../context/AuthContext'

function DeckBuilder() {
  // Context hooks
  const { user } = useAuth()
  const { 
    createDeck, 
    decks, 
    addCardToDeck, 
    getDeckCards, 
    removeCardFromDeck, 
    deleteDeck, 
    setCommander
  } = useDeck()
  const { collection, addToCollection } = useCollection()
  
  // State management for deck building interface
  const [isTestingMode, setIsTestingMode] = useState(false)
  const [deckName, setDeckName] = useState('')
  const [format, setFormat] = useState('commander')
  const [selectedDeck, setSelectedDeck] = useState(null)
  const [deckCards, setDeckCards] = useState([])
  
  // Search functionality state
  const [searchTerm, setSearchTerm] = useState('')
  const [bulkSearchTerm, setBulkSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState([])
  
  // Card management state
  const [cardQuantities, setCardQuantities] = useState({})
  const [commander, setCommanderState] = useState(null)
  const [flippedCards, setFlippedCards] = useState({})
  const [hoverCard, setHoverCard] = useState(null)
  
  // Card prints and UI state
  const [cardPrints, setCardPrints] = useState({})
  const [selectedPrint, setSelectedPrint] = useState(() => {
    const saved = localStorage.getItem('selectedPrints')
    return saved ? JSON.parse(saved) : {}
  })
  const [showingPrintsForCard, setShowingPrintsForCard] = useState(null)
  const [showDeckSelection, setShowDeckSelection] = useState(true)
  // Resets all deck builder state to initial values
  const resetDeckBuilder = () => {
    setSelectedDeck(null)
    setDeckCards([])
    setDeckName('')
    setShowDeckSelection(true)
    setSearchTerm('')
    setBulkSearchTerm('')
    setSearchResults([])
  }

  // Persist selected prints to localStorage when they change
  useEffect(() => {
    localStorage.setItem('selectedPrints', JSON.stringify(selectedPrint))
  }, [selectedPrint])

  // Trigger search when search term changes
  useEffect(() => {
    handleSearch(searchTerm)
  }, [searchTerm])

  // Load deck data when selected deck changes
  useEffect(() => {
    if (selectedDeck) {
      const loadDeckData = async () => {
        const cards = await getDeckCards(selectedDeck.id)
        setDeckCards(cards)
        const freshDeckData = decks.find(d => d.id === selectedDeck.id)
        setCommanderState(freshDeckData?.commander)
      }
      loadDeckData()
    }
  }, [selectedDeck, decks])

  // Filter collection based on search term
  const handleSearch = (term) => {
    if (!term.trim()) {
      setSearchResults([])
      return
    }
    const results = collection.filter(card => 
      card.name.toLowerCase().includes(term.toLowerCase())
    )
    setSearchResults(results)
  }

  // Handle bulk card search using Scryfall API
  const handleBulkSearch = async () => {
    const cardNames = bulkSearchTerm.split('\n').filter(name => name.trim())
    let results = []

    for (const name of cardNames) {
      const url = `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(name.trim())}`
      try {
        const response = await fetch(url)
        if (!response.ok) continue
        const data = await response.json()
        results.push(data)
      } catch (error) {
        console.log(`Error searching for ${name}:`, error)
      }
    }
    setSearchResults(results)
  }
  // Add all search results to the current deck
  const handleAddAllToDeck = async () => {
    if (!selectedDeck) return
    
    for (const card of searchResults) {
      await addCardToDeck(selectedDeck.id, card, cardQuantities[card.id] || 1)
      addToCollection(card)
    }

    const updatedCards = await getDeckCards(selectedDeck.id)
    setDeckCards(updatedCards)
    setSearchResults([])
    setBulkSearchTerm('')
    setSearchTerm('')
    setShowDeckSelection(false)
  }

  // Update quantity for a specific card
  const setCardQuantity = (cardId, quantity) => {
    setCardQuantities(prev => ({
      ...prev,
      [cardId]: Math.max(1, quantity)
    }))
  }

  // Handle card click to show different prints
  const handleCardClick = async (card) => {
    if (!card) return
    
    if (showingPrintsForCard === card.id) {
      setShowingPrintsForCard(null)
      return
    }
    
    setShowingPrintsForCard(card.id)
    const cardName = card.name || card.card_data.name
    const response = await fetch(`https://api.scryfall.com/cards/search?q=!"${cardName}" include:extras unique:prints`)
    const data = await response.json()
    setCardPrints(prev => ({
      ...prev,
      [card.id]: data.data
    }))
  }

  // Select a deck and hide deck selection view
  const handleDeckSelect = (deck) => {
    setSelectedDeck(deck)
    setShowDeckSelection(false)
  }

  // Remove a card from the current deck
  const handleRemoveCard = async (deckId, cardId) => {
    await removeCardFromDeck(deckId, cardId)
    setDeckCards(prevCards => prevCards.filter(card => card.id !== cardId))
  }

  // Toggle card flip state for double-faced cards
  const handleCardFlip = (cardId) => {
    setFlippedCards(prev => ({
      ...prev,
      [cardId]: !prev[cardId]
    }))
  }
  // Create a new deck with given name and format
  const handleCreateDeck = async (e) => {
    e.preventDefault()
    const newDeck = await createDeck(deckName, format)
    if (newDeck) {
      setSelectedDeck(newDeck)
      setDeckName('')
      setShowDeckSelection(false)
    }
  }

  // Delete deck with confirmation
  const handleDeleteDeck = async (deckId) => {
    if (window.confirm('Are you sure you want to delete this deck?')) {
      await deleteDeck(deckId)
      resetDeckBuilder()
    }
  }

  // Add a single card to the current deck
  const handleAddCard = async (card) => {
    if (selectedDeck) {
      const quantity = cardQuantities[card.id] || 1
      await addCardToDeck(selectedDeck.id, card, quantity)
      addToCollection(card)
      const updatedCards = await getDeckCards(selectedDeck.id)
      setDeckCards(updatedCards)
      setCardQuantities(prev => ({ ...prev, [card.id]: 1 }))
    }
  }

  // Set a card as the deck's commander
  const handleSetCommander = async (card) => {
    if (selectedDeck) {
      const response = await fetch(`https://api.scryfall.com/cards/${card.id}`)
      const fullCardData = await response.json()
      
      const commanderData = {
        id: card.id,
        name: card.name,
        image_uris: card.image_uris,
        card_faces: card.card_faces,
        type_line: card.type_line,
        set_name: fullCardData.set_name,
        set: fullCardData.set,
        card_data: fullCardData
      }
      
      setCommanderState(commanderData)
      await setCommander(selectedDeck.id, commanderData)
    }
  }

  // Check if a card can be a commander
  const isValidCommander = (card) => {
    return card.type_line?.includes('Legendary') && card.type_line?.includes('Creature')
  }
  // Calculate total number of cards in deck
  const getTotalCardCount = (cards) => {
    return cards.reduce((total, card) => total + (card.quantity || 1), 0)
  }

  // Organize deck cards by their card types
  const groupCardsByType = (cards) => {
    const groups = {
      Creatures: [],
      Instants: [],
      Sorceries: [],
      Enchantments: [],
      Artifacts: [],
      Planeswalkers: [],
      Lands: []
    }

    cards.forEach(card => {
      if (card.card_data.type_line.includes('Creature')) {
        groups.Creatures.push(card)
      } else if (card.card_data.type_line.includes('Instant')) {
        groups.Instants.push(card)
      } else if (card.card_data.type_line.includes('Sorcery')) {
        groups.Sorceries.push(card)
      } else if (card.card_data.type_line.includes('Enchantment')) {
        groups.Enchantments.push(card)
      } else if (card.card_data.type_line.includes('Artifact')) {
        groups.Artifacts.push(card)
      } else if (card.card_data.type_line.includes('Planeswalker')) {
        groups.Planeswalkers.push(card)
      } else if (card.card_data.type_line.includes('Land')) {
        groups.Lands.push(card)
      }
    })
    return groups
  }

  // Calculate total deck value in USD
  const calculateDeckPrice = (cards) => {
    return cards.reduce((total, card) => {
      const price = card.card_data.prices?.usd || 0
      return total + (price * card.quantity)
    }, 0)
  }

  return (
    <div className={styles.deckBuilder}>
      {/* Deck Selection View - Shows either deck creation or deck building interface */}
      {showDeckSelection ? (
        <>
          {/* Deck Creation Controls Section
              Contains form for creating new decks with:
              - Name input field
              - Format selector (currently Commander only)
              - Submit button */}
          <div className={styles.deckControls}>
            <h2>Create a deck here:</h2>
            <form onSubmit={handleCreateDeck}>
              <input
                type="text"
                value={deckName}
                onChange={(e) => setDeckName(e.target.value)}
                placeholder="Deck Name"
                required
              />
              <select value={format} onChange={(e) => setFormat(e.target.value)}>
                <option value="commander">Commander</option>
              </select>
              <button type="submit">Create Deck</button>
            </form>
          </div>

          {/* Existing Decks Grid Section
              Displays all user's decks in a grid layout
              Each deck shows:
              - Commander image (if set)
              - Deck name
              - Clickable area to select deck */}
          <h3>Or select one of your current decks below:</h3>
          <div className={styles.deckSelection}>
            <div className={styles.deckGrid}>
              {decks.map(deck => (
                <div key={deck.id}>
                  {/* Deck Card Component
                      - Shows commander image or placeholder
                      - Handles commander artwork selection on click
                      - Shows deck name
                      - Clickable to select deck */}
                  <div className={styles.deckCard}>
                    {deck.commander ? (
                      <img
                        src={selectedPrint[deck.commander.id]?.image_uris?.normal || deck.commander.image_uris?.normal}
                        alt={deck.commander.name}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleCardClick(deck.commander)
                        }}
                      />
                    ) : (
                      <div className={styles.placeholderImage}>
                        No Commander Set
                      </div>
                    )}
                    <div className={styles.deckInfo} onClick={() => handleDeckSelect(deck)}>
                      <h3>{deck.name}</h3>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        /* Deck Building Interface
           Main workspace for editing and managing selected deck */
        <div className={styles.deckBuilderContainer}>
          {/* Navigation and Control Buttons
              - Back to deck selection
              - Toggle deck testing mode
              - Delete current deck */}
          <div className={styles.deckBuilderContainer}>
            <div className={styles.navigationButtons}>
              <button 
                className={styles.backButton} 
                onClick={resetDeckBuilder}
              >
                Back to Deck Selection
              </button>
              
              <button 
                className={styles.testDeckButton}
                onClick={() => setIsTestingMode(!isTestingMode)}
              >
                {isTestingMode ? 'Back to Deck' : 'Test Deck'}
              </button>
              
              <button 
                className={styles.deleteButton}
                onClick={() => handleDeleteDeck(selectedDeck.id)}
              >
                Delete Deck
              </button>
            </div>
          </div>

          {/* Main Deck Building Grid
              Split into search section and deck view */}
          <div className={styles.deckBuilderGrid}>
            {/* Card Search Section
                Includes single card search and bulk import functionality */}
            <div className={styles.searchSection}>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search for cards..."
                className={styles.searchInput}
              />              
              {/* Bulk Card Import Interface
                  Allows pasting multiple card names for batch import */}
              <div className={styles.bulkSearch}>
                <textarea
                  value={bulkSearchTerm}
                  onChange={(e) => setBulkSearchTerm(e.target.value)}
                  placeholder="Enter multiple card names (one per line)"
                  className={styles.deckBuilderTextarea}
                />
                <button onClick={handleBulkSearch}>Search Multiple Cards</button>
              </div>

              {/* Search Results Display
                  Shows found cards with their details and controls */}
              <div className={styles.searchResults}>
                {/* "Add All" button appears when results exist */}
                {searchResults.length > 0 && (
                  <button 
                    className={styles.addAllButton}
                    onClick={handleAddAllToDeck}
                  >
                    Add All to Deck
                  </button>
                )}
                {/* Individual Card Results
                    Each result shows:
                    - Card image (with flip functionality for transform cards)
                    - Card details
                    - Quantity controls
                    - Add to deck button
                    - Set as commander button (if eligible) */}
                {searchResults.map(card => (
                  <div key={card.id} className={styles.cardResult}>
                    {card.layout === 'transform' ? (
                      <div className={styles.cardImage} onClick={() => handleCardFlip(card.id)}>
                        <img 
                          src={card.card_faces[flippedCards[card.id] ? 1 : 0].image_uris.normal}
                          alt={card.name}
                        />
                        <span className={styles.flipHint}>Click to flip</span>
                      </div>
                    ) : (
                      <img src={card.image_uris?.normal} alt={card.name} />
                    )}
                    {/* Card Information Display */}
                    <div className={styles.cardInfo}>
                      <h3>{card.name}</h3>
                      <p>Set: {card.set_name}</p>
                      <p>Type: {card.type_line}</p>
                      <p>Mana Cost: {card.mana_cost}</p>
                      {/* Quantity Control Interface */}
                      <div className={styles.quantityControls}>
                        <button onClick={() => setCardQuantity(card.id, (cardQuantities[card.id] || 1) - 1)}>-</button>
                        <span>{cardQuantities[card.id] || 1}</span>
                        <button onClick={() => setCardQuantity(card.id, (cardQuantities[card.id] || 1) + 1)}>+</button>
                      </div>
                    </div>
                    {/* Card Action Buttons */}
                    <button onClick={() => handleAddCard(card)}>Add to Deck</button>
                    {isValidCommander(card) && (
                      <button 
                        className={styles.commanderButton}
                        onClick={() => handleSetCommander(card)}
                      >
                        Set as Commander
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Deck View Section */}
            <div className={styles.deckView}>
              {/* Deck View - Toggles between Testing Mode and Regular View */}
              {isTestingMode ? (
                <DeckTester deck={prepareDeckForTesting(deckCards)} />
              ) : (
                <>
                  {/* Deck Header - Shows name and statistics */}
                  <div className={styles.deckHeader}>
                    <h3>{selectedDeck?.name ?? 'New Deck'}</h3>
                    <h4 className={styles.totalCount}>
                      Total Cards: {getTotalCardCount(deckCards)} | 
                      Deck Value: ${calculateDeckPrice(deckCards).toFixed(2)}
                    </h4>
                  </div>
                  
                  {/* Deck Statistics Component */}
                  <DeckStats cards={deckCards} />

                  {/* Grouped Card Display
                      Shows cards organized by type with counts */}
                  {Object.entries(groupCardsByType(deckCards)).map(([type, cards]) => (
                    cards.length > 0 && (
                      <div key={type} className={styles.cardTypeGroup}>
                        <h4>{type} ({cards.length})</h4>
                        {/* Individual Card Entries */}
                        {cards.map(card => (
                          <div 
                            key={card.id} 
                            className={styles.deckCard}
                            onClick={() => handleCardClick(card)}
                            onMouseEnter={(e) => {
                              setHoverCard({
                                card: card.card_data,
                                x: e.clientX + 10,
                                y: e.clientY + 10
                              })
                            }}
                            onMouseLeave={() => setHoverCard(null)}
                          >
                            {/* Card Entry Display */}
                            <span>{card.quantity}x</span>
                            <span>{card.card_data.name}</span>
                            <button onClick={(e) => {
                              e.stopPropagation()
                              handleRemoveCard(selectedDeck.id, card.id)
                            }}>Remove</button>
                          </div>
                        ))}
                      </div>
                    )
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Card Hover Preview Popup */}
      {hoverCard && (
        <div 
          className={popupStyles.cardPopup} 
          style={{ left: hoverCard.x, top: hoverCard.y }}
        >
          <img 
            className={popupStyles.cardPopupImage}
            src={hoverCard.card.image_uris?.normal} 
            alt={hoverCard.card.name} 
          />
        </div>
      )}
      {/* Alternative Card Prints Selector */}
      {showingPrintsForCard && cardPrints[showingPrintsForCard] && (
        <div className={styles.printsSelector}>
          <h3>Select Artwork</h3>
          <div className={styles.printsGrid}>
            {cardPrints[showingPrintsForCard].map(print => (
              <img 
                key={print.id}
                src={print.image_uris?.normal}
                alt={print.set_name}
                className={styles.printOption}
                onClick={() => {
                  setSelectedPrint(prev => ({
                    ...prev,
                    [showingPrintsForCard]: print
                  }))
                  setShowingPrintsForCard(null)
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
} // Add this closing bracket for the DeckBuilder component

// Prepare deck for testing mode by creating correct number of card copies
const prepareDeckForTesting = (deckCards) => {
  const testDeck = deckCards.flatMap(card => {
    const copies = Array(card.quantity).fill(card.card_data)
    return copies
  })
  
  return testDeck
}

export default DeckBuilder