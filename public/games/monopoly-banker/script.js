// Class Section ===============================================================================================
class Game {
    constructor(players, board) {
        this.players = players
        this.board = board
        this.currentPlayer = players[0]
    }
}

class Player {
    constructor(name) {
        this.name = name
        this.wallet = 2500
        this.properties = []
        this.monopolies = []
        this.currentSpace = 1
    }

    move(spaces) {
        this.currentSpace = (this.currentSpace + spaces) % 40
    }

    purchaseHouses(game, numHouses, monopoly) {
        let numberOfProperties = monopoly[1].length
        let housesToPlaceOnAllProperties = Math.floor(numHouses / numberOfProperties)
        let leftOverHouses = numHouses % numberOfProperties

        // Place even houses on all properties
        for (let i = 0; i < housesToPlaceOnAllProperties; i++) {
            monopoly[1].forEach(property => {
                property.addHouse()
            })
        }

        updatePlayerValues(game)

        if (leftOverHouses > 0) {
            messageBox.textContent = `${housesToPlaceOnAllProperties} houses have been applied to all ${numberOfProperties} properties, you have ${leftOverHouses} houses left to place!`

            monopoly[1].forEach(property => {
                // create button
                let button = document.createElement("button")
                // give button name
                button.textContent = property.name
                // event handler for button
                button.addEventListener("click", () => {
                    // add house to property
                    property.addHouse()
                    // subtract one from houses
                    leftOverHouses -= 1
                    // remove button
                    button.remove()

                    if (leftOverHouses == 0) {
                        messageBox.textContent = "all the houses have been placed!"
                        actionButtonsBox.innerHTML = ""
                        afterTurnMenu(game)
                    } else {
                        // reset message box
                        messageBox.textContent = `you have ${leftOverHouses} houses left to place!`
                    }
                })
                // add button to the button box
                actionButtonsBox.appendChild(button)
            })
        } else {
            messageBox.textContent = `${housesToPlaceOnAllProperties} houses have been applied to all ${numberOfProperties} properties`
            actionButtonsBox.innerHTML = ""
            afterTurnMenu(game)
        }
    }

    sellHouses(game, numHouses, monopoly) {
        let numberOfProperties = monopoly[1].length
        let housesToSellFromAllProperties = Math.floor(numHouses / numberOfProperties)
        let leftOverHouses = numHouses % numberOfProperties

        // Sell even houses from all properties
        for (let i = 0; i < housesToSellFromAllProperties; i++) {
            monopoly[1].forEach(property => {
                if (property.houses > 0) {
                    property.houses -= 1
                    this.wallet += Math.floor(property.housePrice / 2)
                    property.changeRent()
                }
            })
        }

        updatePlayerValues(game)

        if (leftOverHouses > 0) {
            messageBox.textContent = `${housesToSellFromAllProperties} houses have been sold from all ${numberOfProperties} properties, you have ${leftOverHouses} houses left to sell!`

            monopoly[1].forEach(property => {
                if (property.houses > 0) {
                    // create button
                    let button = document.createElement("button")
                    // give button name
                    button.textContent = property.name
                    // event handler for button
                    button.addEventListener("click", () => {
                        // sell house from property
                        property.houses -= 1
                        this.wallet += Math.floor(property.housePrice / 2)
                        property.changeRent()
                        // subtract one from houses
                        leftOverHouses -= 1
                        // remove button
                        button.remove()

                        if (leftOverHouses == 0) {
                            messageBox.textContent = "all the houses have been sold!"
                            actionButtonsBox.innerHTML = ""
                            afterTurnMenu(game)
                        } else {
                            // reset message box
                            messageBox.textContent = `you have ${leftOverHouses} houses left to sell!`
                        }
                    })
                    // add button to the button box
                    actionButtonsBox.appendChild(button)
                }
            })
        } else {
            messageBox.textContent = `${housesToSellFromAllProperties} houses have been sold from all ${numberOfProperties} properties`
            actionButtonsBox.innerHTML = ""
            afterTurnMenu(game)
        }
    }
    
    checkForMonopolies() {
        // check CURRENT monopolies if they have one
        if (this.monopolies.length > 0) {
            // loop through each monopoly
            this.monopolies.forEach(monopoly => {
                // loop through monopolies, check if each one is also in properties
                let removeMonopoly = false
                // if property is not in players properties, it will switch boolean to true
                monopoly[1].forEach(property => {
                    if (!this.properties.includes(property)) {
                        removeMonopoly = true
                    }
                })
                // if boolean is true, remove the monopoly from player's monopolies
                if (removeMonopoly == true) {
                    this.monopolies.splice(this.monopolies.indexOf(monopoly),1)
                }
            })
        }

        // Check for any NEW monopolies
        let colors = ["brown", "light blue", "pink", "orange", "red", "yellow", "green", "dark blue"]
        // loop through every color
        colors.forEach(color => {
            // set the number of properties needed for a monopoly
            let numPropertiesForMonopoly = 3
            if (color == "brown" || color == "dark blue") {
                numPropertiesForMonopoly = 2
            } 
                
            

            let propertiesThatMatch = []
            this.properties.forEach(property => {
                if (property.color == color) {
                    propertiesThatMatch.push(property)
                }
            })
            if (numPropertiesForMonopoly == propertiesThatMatch.length) {
                // checks to see if the monopoly is already in there, if not, it'll add it
                if (!this.monopolies.some(m => m[0] === color)) {
                    this.monopolies.push([color, propertiesThatMatch])
}
                
            } 
        })
    }
}

class Property {
    constructor(name, price, color, housePrice, houses, rent, rent1, rent2, rent3, rent4, rent5, morgageValue, owner="none") {
        this.name = name
        this.price = price
        this.color = color
        this.housePrice = housePrice
        this.houses = houses
        this.rent = rent
        this.rent1 = rent1
        this.rent2 = rent2
        this.rent3 = rent3
        this.rent4 = rent4
        this.rent5 = rent5
        this.morgageValue = morgageValue
        this.owner = owner
    }

    addHouse() {
        if (this.houses < 5) {
            this.houses += 1
            this.owner.wallet -= this.housePrice
            this.changeRent()
        } else {
            alert("this property already has a hotel! cannot add new house")
        }  
    }
    changeRent() {
        if (this.houses == 1) {
            this.rent = this.rent1
        } else if (this.houses == 2) {
            this.rent = this.rent2
        } else if (this.houses == 3) {
            this.rent = this.rent3
        } else if (this.houses == 4) {
            this.rent = this.rent4
        } else if (this.houses == 5) {
            this.rent = this.rent5
        }
    }
}
// =============================================================================================================

// global Variables

let setupDiv = document.createElement("div")
setupDiv.id = "setupDiv"
let mainElement = document.querySelector("main")
mainElement.insertBefore(setupDiv, mainElement.firstChild)
setupDiv.textContent = " "

let gameBox = document.getElementById("gameBox")
let currentTurnBox = document.getElementById("currentTurnBox")
let messageBox = document.getElementById("messageBox")
let actionButtonsBox = document.getElementById("actionButtonsBox")


// function that creates board and returns it
function initializeBoard() {
    let board = []

    board[0] = "go"
    board[1] = new Property("Mediterranean Avenue", 60, "brown", 50, 0, 2, 10, 30, 90, 160, 250, 30)
    board[2] = "community chest"
    board[3] = new Property("Baltic Avenue", 60, "brown", 50, 0, 4, 20, 60, 180, 320, 450, 30)
    board[4] = "income tax"
    board[5] = "reading railroad"
    board[6] = new Property("Oriental Avenue", 100, "light blue", 50, 0, 6, 30, 90, 270, 400, 550, 50)
    board[7] = "chance"
    board[8] = new Property("Vermont Avenue", 100, "light blue", 50, 0, 6, 30, 90, 270, 400, 550, 50)
    board[9] = new Property("Connecticut Avenue", 120, "light blue", 50, 0, 8, 40, 100, 300, 450, 600, 60)
    board[10] = "jail"
    board[11] = new Property("St. Charles Place", 140, "pink", 100, 0, 10, 50, 150, 450, 625, 750, 70)
    board[12] = "electric company"
    board[13] = new Property("States Avenue", 140, "pink", 100, 0, 10, 50, 150, 450, 625, 750, 70)
    board[14] = new Property("Virginia Avenue", 160, "pink", 100, 0, 12, 60, 180, 500, 700, 900, 80)
    board[15] = "pennsylvania railroad"
    board[16] = new Property("St. James Place", 180, "orange", 100, 0, 14, 70, 200, 550, 750, 950, 90)
    board[17] = "community chest"
    board[18] = new Property("Tennessee Avenue", 180, "orange", 100, 0, 14, 70, 200, 550, 750, 950, 90)
    board[19] = new Property("New York Avenue", 200, "orange", 100, 0, 16, 80, 220, 600, 800, 1000, 100)
    board[20] = "free parking"
    board[21] = new Property("Kentucky Avenue", 220, "red", 150, 0, 18, 90, 250, 700, 875, 1050, 110)
    board[22] = "chance"
    board[23] = new Property("Indiana Avenue", 220, "red", 150, 0, 18, 90, 250, 700, 875, 1050, 110)
    board[24] = new Property("Illinois Avenue", 240, "red", 150, 0, 20, 100, 300, 750, 925, 1100, 120)
    board[25] = "b&o railroad"
    board[26] = new Property("Atlantic Avenue", 260, "yellow", 150, 0, 22, 110, 330, 800, 975, 1150, 130)
    board[27] = new Property("Ventnor Avenue", 260, "yellow", 150, 0, 22, 110, 330, 800, 975, 1150, 130)
    board[28] = "water works"
    board[29] = new Property("Marvin Gardens", 280, "yellow", 150, 0, 24, 120, 360, 850, 1025, 1200, 140)
    board[30] = "go to jail"
    board[31] = new Property("Pacific Avenue", 300, "green", 200, 0, 26, 130, 390, 900, 1100, 1275, 150)
    board[32] = new Property("North Carolina Avenue", 300, "green", 200, 0, 26, 130, 390, 900, 1100, 1275, 150)
    board[33] = "community chest"
    board[34] = new Property("Pennsylvania Avenue", 320, "green", 200, 0, 28, 150, 450, 1000, 1200, 1400, 160)
    board[35] = "short line railroad"
    board[36] = "chance"
    board[37] = new Property("Park Place", 350, "dark blue", 200, 0, 35, 175, 500, 1100, 1300, 1500, 175)
    board[38] = "luxury tax"
    board[39] = new Property("Boardwalk", 400, "dark blue", 200, 0, 50, 200, 600, 1400, 1700, 2000, 200)

    return board
}




function setupGame() {
    if (setupDiv.textContent == " ") {
        

    // setup title
    let setupTitle = document.createElement("h1")
    setupTitle.textContent = "Setup New Game"
    setupDiv.appendChild(setupTitle)

    // label for number of players
    let numPlayersLabel = document.createElement("label")
    numPlayersLabel.textContent = "Number of Players"
    numPlayersLabel.htmlFor = "numPlayersSelect"
    setupDiv.appendChild(numPlayersLabel)

    // slect for number of players
    let numPlayersSelect = document.createElement("select")
    numPlayersSelect.id = "numPlayersSelect"
    setupDiv.appendChild(numPlayersSelect)
    const options = ["2 players", "3 players", "4 players", "5 players", "6 players"]

    // loops through options and sets it to an option for the select
    options.forEach(optionValue => {
        let option = document.createElement("option")
        option.value = optionValue
        option.label = optionValue
        numPlayersSelect.appendChild(option)
    })

    // create box for player name inputs
    let playerNamesDiv = document.createElement("div")
    setupDiv.appendChild(playerNamesDiv)
    let playerOptions = ["player1","player2"]
    playerOptions.forEach(player => {
        let label = document.createElement("label")
        label.textContent = player + ": "
        label.htmlFor = player
        let playerName = document.createElement("input")
        playerName.id = player
        playerNamesDiv.appendChild(label)
        playerNamesDiv.appendChild(playerName)
        playerNamesDiv.appendChild(document.createElement("br"))
    })

    // create submit button 
    let numPlayersSubmitBtn = document.createElement("button")
    numPlayersSubmitBtn.textContent = "start game"
    numPlayersSubmitBtn.addEventListener("click", () => {
        let inputs = playerNamesDiv.querySelectorAll("input")
        let playerNames = []
        inputs.forEach(input => {
            let playerName = input.value
            playerNames.push(playerName)
        })
        setupDiv.innerHTML = ""

        let newGameBtn = document.getElementById("newGameBtn")
        newGameBtn.remove()

        // STARTS GAME AFTER CLEARING SETUP DIV
        startGame(playerNames)
    })
    setupDiv.appendChild(numPlayersSubmitBtn)

    // logic for the change of num player select
    numPlayersSelect.addEventListener("change", () => {
        let numPlayers = numPlayersSelect.value
        if (numPlayers == "2 players") {
            playerNamesDiv.innerHTML = ""
            playerOptions = ["player1","player2"]
            playerOptions.forEach(player => {
                let label = document.createElement("label")
                label.textContent = player + ": "
                label.htmlFor = player
                let playerName = document.createElement("input")
                playerName.id = player
                playerNamesDiv.appendChild(label)
                playerNamesDiv.appendChild(playerName)
                playerNamesDiv.appendChild(document.createElement("br"))
            })
        } else if (numPlayers == "3 players") {
            playerNamesDiv.innerHTML = ""
            playerOptions = ["player1","player2","player3"]
            playerOptions.forEach(player => {
                let label = document.createElement("label")
                label.textContent = player + ": "
                label.htmlFor = player
                let playerName = document.createElement("input")
                playerName.id = player
                playerNamesDiv.appendChild(label)
                playerNamesDiv.appendChild(playerName)
                playerNamesDiv.appendChild(document.createElement("br"))
            })

        } else if (numPlayers == "4 players") {
            playerNamesDiv.innerHTML = ""
            playerOptions = ["player1","player2","player3","player4"]
            playerOptions.forEach(player => {
                let label = document.createElement("label")
                label.textContent = player + ": "
                label.htmlFor = player
                let playerName = document.createElement("input")
                playerName.id = player
                playerNamesDiv.appendChild(label)
                playerNamesDiv.appendChild(playerName)
                playerNamesDiv.appendChild(document.createElement("br"))
            })

        } else if (numPlayers == "5 players") {
            playerNamesDiv.innerHTML = ""
            playerOptions = ["player1","player2","player3","player4","player5"]
            playerOptions.forEach(player => {
                let label = document.createElement("label")
                label.textContent = player + ": "
                label.htmlFor = player
                let playerName = document.createElement("input")
                playerName.id = player
                playerNamesDiv.appendChild(label)
                playerNamesDiv.appendChild(playerName)
                playerNamesDiv.appendChild(document.createElement("br"))
            })

        } else if (numPlayers == "6 players") {
            playerNamesDiv.innerHTML = ""
            playerOptions = ["player1","player2","player3","player4","player5","player6"]
            playerOptions.forEach(player => {
                let label = document.createElement("label")
                label.textContent = player + ": "
                label.htmlFor = player
                let playerName = document.createElement("input")
                playerName.id = player
                playerNamesDiv.appendChild(label)
                playerNamesDiv.appendChild(playerName)
                playerNamesDiv.appendChild(document.createElement("br"))
            })
        }
    })


}}

function createBoard(game) {
    let boardDiv = document.getElementById("board")
    boardDiv.innerHTML = ""
    game.board.forEach((space, index) => {
        let spaceDiv = document.createElement("div")
        spaceDiv.className = "space"
        
        if (space instanceof Property) {
            spaceDiv.textContent = space.name
            // Set background color - replace all spaces
            spaceDiv.style.backgroundColor = space.color.replace(/\s+/g, "")
            if (space.owner != "none") {
                spaceDiv.textContent += ` (${space.owner.name})`
                if (space.houses > 0) {
                    spaceDiv.textContent += ` [${space.houses}]`
                }
            }
        } else {
            // Special spaces - format text better
            let spaceText = space.toString()
            // Capitalize first letter of each word
            spaceText = spaceText.split(' ').map(word => 
                word.charAt(0).toUpperCase() + word.slice(1)
            ).join(' ')
            spaceDiv.textContent = spaceText
            spaceDiv.style.fontWeight = "700"
        }
        
        // Position
        if (index <= 10) {
            // top
            spaceDiv.style.gridRow = 1
            spaceDiv.style.gridColumn = 12 - index
        } else if (index <= 20) {
            // right
            spaceDiv.style.gridColumn = 11
            spaceDiv.style.gridRow = index - 9
        } else if (index <= 30) {
            // bottom
            spaceDiv.style.gridRow = 11
            spaceDiv.style.gridColumn = index - 19
        } else {
            // left
            spaceDiv.style.gridColumn = 1
            spaceDiv.style.gridRow = 32 - index
        }
        boardDiv.appendChild(spaceDiv)
    })
}

function updatePlayerValues(game) {
    let players = game.players
    createBoard(game)
    let playerValuesSection = document.getElementById("playerValuesSection")
    playerValuesSection.innerHTML = ""
    players.forEach(player => {

        player.checkForMonopolies()
        // add a space for name
        let playerName = document.createElement("h2")
        playerName.textContent = player.name
        // add a space for wallet
        let playerWalletLabel = document.createElement("label")
        playerWalletLabel.textContent = "Balance: "
        let playerWallet = document.createElement("input")
        playerWallet.readOnly = true
        playerWallet.value = player.wallet
        // add a sapce fo currentSpace
        let playerCurrentSpaceLabel = document.createElement("label")
        playerCurrentSpaceLabel.textContent = "Current Space: "
        let playerCurrentSpace = document.createElement("input")
        playerCurrentSpace.readOnly = true
        playerCurrentSpace.value = player.currentSpace

        //add a section for properties
        let playerPropertiesLabel = document.createElement("h3")
        playerPropertiesLabel.textContent = "Properties: "
        let playerProperties = document.createElement("ul")
        
        player.properties.forEach(property => {
            let propertyListItem = document.createElement("li")
            propertyListItem.textContent = `${property.name} / color: ${property.color} / rent: ${property.rent} / price per house: ${property.housePrice}`
            propertyListItem.style.backgroundColor = property.color.replace(/\s+/g, "")
            playerProperties.appendChild(propertyListItem)
        })

        // add monopolies section
        let playerMonopoliesLabel = document.createElement("h3")
        playerMonopoliesLabel.textContent = "Monopolies: "
        let playerMonopolies = document.createElement("div")
        // for each monoply create a title and list element
        player.monopolies.forEach(monopoly => {
            let monopolyColor = document.createElement("h4")
            monopolyColor.textContent = monopoly[0]
            let monopolyList = document.createElement("ul")
            playerMonopolies.appendChild(monopolyColor)
            playerMonopolies.appendChild(monopolyList)

           // loop through the propertiesi n the monopoly and add them to the list
            monopoly[1].forEach(property => {
                let monopolyListItem = document.createElement("li")
                monopolyListItem.textContent = `${property.name} / Houses: [${property.houses}] `
                monopolyList.appendChild(monopolyListItem)
            })
        })

        // add playerValues to the div
        let playerDiv = document.createElement("div")
        playerValuesSection.appendChild(playerDiv)
       
        playerDiv.id = player.name + "Values"
        playerDiv.classList = "playerValuesBox"
        
        playerDiv.appendChild(playerName)
        playerDiv.appendChild(playerWalletLabel)
        playerDiv.appendChild(playerWallet)
        playerDiv.appendChild(document.createElement("br"))
        playerDiv.appendChild(playerCurrentSpaceLabel)
        playerDiv.appendChild(playerCurrentSpace)
        playerDiv.appendChild(document.createElement("br"))
        playerDiv.appendChild(playerPropertiesLabel)
        playerDiv.appendChild(playerProperties)
        playerDiv.appendChild(playerMonopoliesLabel)
        playerDiv.appendChild(playerMonopolies)

    })
}       
    

// start game and play game functions
// ===============================================================================================================

function startGame(playerNames) {
    // create players
    let players = [] 
    playerNames.forEach(playerName => {
        let player = new Player(playerName)
        players.push(player)
    })
     // creates board using initializeBoard function
    let board = initializeBoard()
    console.log(board)
    console.log(players) // displays playerList in console for debugging purposes

    // TESTING: function to give a player a green monopoly
    givePlayerOneAMonopolyTesting(players, board)

    let game = new Game(players, board)
    // display values to page
    updatePlayerValues(game)
    // ============================================
    console.log(game)
    playGame(game)
}

function rollDie() {
    return Math.floor(Math.random() * 6) + 1
}

function payRent(game, property) {
    if (game.currentPlayer.wallet >= property.rent) {
        game.currentPlayer.wallet -= property.rent
        property.owner.wallet += property.rent
        messageBox.innerHTML += `${property.name} is owned by ${property.owner.name}, you paid them ${property.rent} in rent`
        afterTurnMenu(game)
    } else {
        // bankruptcy
        messageBox.innerHTML += `${property.name} is owned by ${property.owner.name}, you owe ${property.rent} in rent but only have ${game.currentPlayer.wallet}. You must sell assets to pay!`
        // offer to sell houses or properties
        let sellHousesBtn = document.createElement("button")
        sellHousesBtn.textContent = "Sell Houses"
        sellHousesBtn.addEventListener("click", () => {
            bankruptcySellHouses(game, property.rent - game.currentPlayer.wallet, property)
        })
        actionButtonsBox.appendChild(sellHousesBtn)

        let sellPropertiesBtn = document.createElement("button")
        sellPropertiesBtn.textContent = "Sell Properties"
        sellPropertiesBtn.addEventListener("click", () => {
            bankruptcySellProperties(game, property.rent - game.currentPlayer.wallet, property)
        })
        actionButtonsBox.appendChild(sellPropertiesBtn)
    }
}

function bankruptcySellProperties(game, amountNeeded, property) {
    messageBox.textContent = `You need to raise ${amountNeeded} by selling properties. Select properties to sell for half price.`
    actionButtonsBox.innerHTML = ""
    game.currentPlayer.properties.forEach(prop => {
        let sellBtn = document.createElement("button")
        sellBtn.textContent = `Sell ${prop.name} for ${Math.floor(prop.price / 2)}`
        sellBtn.addEventListener("click", () => {
            game.currentPlayer.wallet += Math.floor(prop.price / 2)
            prop.owner = "none"
            game.currentPlayer.properties.splice(game.currentPlayer.properties.indexOf(prop), 1)
            game.currentPlayer.checkForMonopolies()
            updatePlayerValues(game)
            if (game.currentPlayer.wallet >= property.rent) {
                payRent(game, property)
            } else {
                // still not enough, continue
                bankruptcySellProperties(game, property.rent - game.currentPlayer.wallet, property)
            }
        })
        actionButtonsBox.appendChild(sellBtn)
    })
}

function bankruptcySellHouses(game, amountNeeded, property) {
    messageBox.textContent = `You need to raise ${amountNeeded} by selling houses. Select houses to sell for half price.`
    actionButtonsBox.innerHTML = ""
    game.currentPlayer.monopolies.forEach(monopoly => {
        monopoly[1].forEach(prop => {
            if (prop.houses > 0) {
                let sellBtn = document.createElement("button")
                sellBtn.textContent = `Sell house on ${prop.name} for ${Math.floor(prop.housePrice / 2)}`
                sellBtn.addEventListener("click", () => {
                    prop.houses -= 1
                    game.currentPlayer.wallet += Math.floor(prop.housePrice / 2)
                    prop.changeRent()
                    updatePlayerValues(game)
                    if (game.currentPlayer.wallet >= property.rent) {
                        payRent(game, property)
                    } else {
                        // still not enough, continue
                        bankruptcySellHouses(game, property.rent - game.currentPlayer.wallet, property)
                    }
                })
                actionButtonsBox.appendChild(sellBtn)
            }
        })
    })
}

function takeTurn(game) {
    currentTurnBox.textContent = "it is " + game.currentPlayer.name + "'s turn!"
    messageBox.textContent = "Take your turn by rolling the dice!"
    actionButtonsBox.innerHTML = ""
    let rollBtn = document.createElement("button")
    rollBtn.textContent = "roll dice!"
    rollBtn.addEventListener("click", () => {
        let die1 = rollDie()
        let die2 = rollDie()
        let roll = die1 + die2
        messageBox.innerHTML = `${game.currentPlayer.name} rolled a ${die1} and ${die2}. Total Roll: ${roll}<br>`
        game.currentPlayer.move(roll)
        // handle roll
        rollBtn.remove()
        let newSpace = game.board[game.currentPlayer.currentSpace]
        updatePlayerValues(game)
        console.log("Game Log: " + game.currentPlayer.name + " rolled "+ roll + " and landed on " + newSpace) // game log
        if (newSpace instanceof Property) {
            // logic for if the property isn't owned
            if (newSpace.owner == "none") {
                // checks to see if the price is too much, if not they enter the buy property menu
                if (newSpace.price > game.currentPlayer.wallet) {
                    messageBox.innerHTML += `you landed on ${newSpace.name}! It costs ${newSpace.price}$, you cannot afford it (lol brokie)`
                    afterTurnMenu(game)
                }
                else {
                    messageBox.innerHTML += `you landed on ${newSpace.name}! It costs ${newSpace.price}$<br>would you like to buy it?<br>`
                let purchaseBtn = document.createElement("button")
                purchaseBtn.textContent = "Buy Property"
                purchaseBtn.addEventListener("click", () => {
                    game.currentPlayer.wallet -= newSpace.price 
                    newSpace.owner = game.currentPlayer
                    game.currentPlayer.properties.push(newSpace)
                    messageBox.textContent = `Congradulations! You bought ${newSpace.name}! It has been added to your properties`
                    afterTurnMenu(game)
                })
                actionButtonsBox.appendChild(purchaseBtn)

                let dontPurchaseBtn = document.createElement("button")
                dontPurchaseBtn.textContent = "Don't Buy"
                dontPurchaseBtn.addEventListener("click", () => {
                    actionButtonsBox.innerHTML = ""
                    messageBox.textContent = `You did not buy ${newSpace.name}`
                    afterTurnMenu(game)
                })
                actionButtonsBox.appendChild(dontPurchaseBtn)       
            }   
                }
                
            // logic for if someone owns the property you landed on
            else {
                payRent(game, newSpace)
            }
        // user lands on special property (not yet developed)
        } else {
                messageBox.innerHTML += `you landed on ${newSpace}, more development coming soon! for now it is a free space :)`
                afterTurnMenu(game)
            }
        

    
    })
    actionButtonsBox.appendChild(rollBtn)
}

// MAKE TRADE LOGIC
// ==============================================================================================================
function makeTrade(game, trader, tradee) {
    let tradersTradeProperties = []
    let tradeesTradeProperties = []
    messageBox.textContent = ""
    actionButtonsBox.innerHTML = ""
    messageBox.textContent = `${trader.name} is looking to make a trade with ${tradee.name}`
    let tradeContainer = document.createElement("div")
    tradeContainer.id = "tradeContainer"
    gameBox.appendChild(tradeContainer)
    //CREATE TRADERBOX ==========================================================================================
    // traderBox is the div that holds all the elements for trade
    let traderBox = document.createElement("div")
    traderBox.className = "tradeBox"
    tradeContainer.appendChild(traderBox)
    // create title
    let traderBoxTitle = document.createElement("h2")
    traderBoxTitle.textContent = trader.name
   

    // add money for trader side
    let traderMoneyLabel = document.createElement("label")
    traderMoneyLabel.textContent = "Trader money in trade:"
    traderMoneyLabel.htmlFor = "traderMoney"
    let traderMoney = document.createElement("input")
    traderMoney.id = "traderMoney"
    traderMoney.type = "number"
    traderMoney.min = 0
    traderMoney.max = trader.wallet
    traderMoney.defaultValue = 0
    
    // create a select for user to add properties to trade
    let traderPropertySelect = document.createElement("select")
    traderPropertySelect.id = "traderPropertySelect"
    
    // add options for select
    trader.properties.forEach(property => {
        let option = document.createElement("option")
        option.value = trader.properties.indexOf(property)
        option.label = property.name
        option.id = property.name + "option"
        console.log(property.name, option.value)
        traderPropertySelect.appendChild(option)
    })

    // show properties to be traded that are added 
    let traderTradeDisplay = document.createElement("textarea")
    traderTradeDisplay.readOnly = true
    traderTradeDisplay.style.width = "200px"
    traderTradeDisplay.style.height = "100px"

    // create button for adding property
    let traderAddPropertyBtn = document.createElement("button")
    traderAddPropertyBtn.textContent = "add property"
    traderAddPropertyBtn.addEventListener("click", () => {
        let propertyToAddToTrade = trader.properties[parseInt(traderPropertySelect.value)]
        // add to trade
        tradersTradeProperties.push(propertyToAddToTrade)
        // add to display
        traderTradeDisplay.value += `${propertyToAddToTrade.name}\n`
        // remove option
        const opt = document.getElementById(`${propertyToAddToTrade.name}option`)
        opt.remove()

        console.log(tradersTradeProperties)
    })

    traderBox.appendChild(traderBoxTitle)
    traderBox.appendChild(document.createElement("br"))
    traderBox.appendChild(traderMoneyLabel)
    traderBox.appendChild(traderMoney)
    traderBox.appendChild(document.createElement("br"))
    traderBox.appendChild(traderPropertySelect)
    traderBox.appendChild(traderAddPropertyBtn)
    traderBox.appendChild(document.createElement("br"))
    traderBox.appendChild(traderTradeDisplay)
    // END OF TRADER BOX ==========================================================================================

    //CREATE BOX FOR TRADEE =======================================================================================
    // tradeeBox is the div that holds all the elements for trade
    let tradeeBox = document.createElement("div")
    tradeeBox.className = "tradeBox"
    tradeContainer.appendChild(tradeeBox)
    // create title
    let tradeeBoxTitle = document.createElement("h2")
    tradeeBoxTitle.textContent = tradee.name
    
    // add money for trader side
    let tradeeMoneyLabel = document.createElement("label")
    tradeeMoneyLabel.textContent = "Tradee money in trade:"
    tradeeMoneyLabel.htmlFor = "tradeeMoney"
    let tradeeMoney = document.createElement("input")
    tradeeMoney.id = "tradeeMoney"
    tradeeMoney.type = "number"
    tradeeMoney.min = 0
    tradeeMoney.max = tradee.wallet
    tradeeMoney.defaultValue = 0
    
    // create a select for user to add properties to trade
    let tradeePropertySelect = document.createElement("select")
    tradeePropertySelect.id = "tradeePropertySelect"
    
    // add options for select
    tradee.properties.forEach(property => {
        let option = document.createElement("option")
        option.value = tradee.properties.indexOf(property)
        option.label = property.name
        option.id = property.name + "option"
        tradeePropertySelect.appendChild(option)
    })
    // show properties to be traded that are added 
    let tradeeTradeDisplay = document.createElement("textarea")
    tradeeTradeDisplay.readOnly = true
    tradeeTradeDisplay.style.width = "200px"
    tradeeTradeDisplay.style.height = "100px"

    let tradeeAddPropertyBtn = document.createElement("button")
    tradeeAddPropertyBtn.textContent = "add property"
    tradeeAddPropertyBtn.addEventListener("click", () => {
        let propertyToAddToTrade = tradee.properties[parseInt(tradeePropertySelect.value)]
        // add it to the trade list 
        tradeesTradeProperties.push(propertyToAddToTrade)
        // update display
        tradeeTradeDisplay.value += `${propertyToAddToTrade.name}\n`
        // remove it from options
        const opt = document.getElementById(`${propertyToAddToTrade.name}option`)
        opt.remove()

        console.log(tradeesTradeProperties)
    })
    tradeeBox.appendChild(tradeeBoxTitle)
    tradeeBox.appendChild(document.createElement("br"))
    tradeeBox.appendChild(tradeeMoneyLabel)
    tradeeBox.appendChild(tradeeMoney)
    tradeeBox.appendChild(document.createElement("br"))
    tradeeBox.appendChild(tradeePropertySelect)
    tradeeBox.appendChild(tradeeAddPropertyBtn)
    tradeeBox.appendChild(document.createElement("br"))
    tradeeBox.appendChild(tradeeTradeDisplay)
    // END OF TRADEE BOX ==========================================================================================


    // logic for confirming trade
    let confirmTradeBtn = document.createElement("button")
    confirmTradeBtn.textContent = "Confirm Trade"
    confirmTradeBtn.addEventListener("click", () => {
        alert("confirm trade!")
        // add all the traders trade properties to the properties attribute for the tradee
        tradersTradeProperties.forEach(property => {
            tradee.properties.push(property)
            trader.properties.splice((trader.properties.indexOf(property)),1)
        })
        // add all the tradees trade properties to the properties attribute for the trader
        tradeesTradeProperties.forEach(property => {
            trader.properties.push(property)
            tradee.properties.splice((tradee.properties.indexOf(property)),1)
        })
        let moneyForTradee = parseInt(traderMoney.value)
        let moneyForTrader = parseInt(tradeeMoney.value)

        console.log(moneyForTradee, moneyForTrader)
        // subtract the money from the wallets
        trader.wallet -= moneyForTradee
        tradee.wallet -= moneyForTrader

        // add it to the other wallet
        trader.wallet += moneyForTrader
        tradee.wallet += moneyForTradee

        messageBox.textContent = "Trade has been accepted!"
        actionButtonsBox.innerHTML = ""
        trader.checkForMonopolies()
        tradee.checkForMonopolies()
        tradeContainer.remove()
        afterTurnMenu(game)
    })

    let denyTradeBtn = document.createElement("button")
    denyTradeBtn.textContent = "Deny Trade"
    denyTradeBtn.addEventListener("click", () => {
        alert("deny trade!")
        messageBox.textContent = "Trade has been denied!"
        actionButtonsBox.innerHTML = ""
        tradeContainer.remove()
        afterTurnMenu(game)
    })
    actionButtonsBox.appendChild(confirmTradeBtn)
    actionButtonsBox.appendChild(denyTradeBtn)

}


function makeTradeMenu(game) {
    actionButtonsBox.innerHTML = ""
    messageBox.textContent = "who would you like to trade with?"
    game.players.forEach(player => {
        if (player == game.currentPlayer) {
            console.log("nah, not this one")
        } else {
            let playerBtn = document.createElement("button")
            playerBtn.textContent = player.name
            playerBtn.addEventListener("click", () => {
                makeTrade(game, game.currentPlayer, player) 
            })
            actionButtonsBox.appendChild(playerBtn)
        }
    })
}
// ==============================================================================================================
// Buy Houses Menu ===============================================================================================

function buyHousesMenu(game) {
    if (game.currentPlayer.monopolies.length > 0) {
            messageBox.textContent = "Which monopoly would you like to buy houses for?"
            actionButtonsBox.innerHTML = ""

            game.currentPlayer.monopolies.forEach(monopoly => {
                let monopolyColor = monopoly[0]
                let monopolyBtn = document.createElement("button")
                monopolyBtn.textContent = monopolyColor
                monopolyBtn.addEventListener("click", () => {
                    buyHouses(game,monopoly)
                })
                actionButtonsBox.appendChild(monopolyBtn)
            })
        } else {
            alert("you do not have any monopolies to buy houses for! :(")
        }
}

function buyHouses(game, monopoly) {
    // create a list of the properties
    let monopolyProperties = []
    monopoly[1].forEach(property => {
        monopolyProperties.push(property)
    })
    let housePrice = monopolyProperties[0].housePrice
    let numHouses = parseInt(prompt(`how many houses would you like to buy, they cost ${housePrice}`))
    console.log(numHouses)
    if ((numHouses * housePrice) > game.currentPlayer.wallet) {
        alert("you do not have enough money!")
    } else {
        // logic for purchasing houses
        game.currentPlayer.purchaseHouses(game, numHouses, monopoly)

    }
}
// ==============================================================================================================
// Sell Houses Menu ===============================================================================================

function sellHousesMenu(game) {
    if (game.currentPlayer.monopolies.length > 0) {
        messageBox.textContent = "Which monopoly would you like to sell houses from?"
        actionButtonsBox.innerHTML = ""

        game.currentPlayer.monopolies.forEach(monopoly => {
            let monopolyColor = monopoly[0]
            let monopolyBtn = document.createElement("button")
            monopolyBtn.textContent = monopolyColor
            monopolyBtn.addEventListener("click", () => {
                sellHouses(game, monopoly)
            })
            actionButtonsBox.appendChild(monopolyBtn)
        })
    } else {
        alert("you do not have any monopolies to sell houses from! :(")
    }
}

function sellHouses(game, monopoly) {
    // create a list of the properties
    let monopolyProperties = []
    monopoly[1].forEach(property => {
        monopolyProperties.push(property)
    })
    let housePrice = monopolyProperties[0].housePrice
    let numHouses = parseInt(prompt(`how many houses would you like to sell, they sell for ${Math.floor(housePrice / 2)} each`))
    console.log(numHouses)
    // logic for selling houses
    game.currentPlayer.sellHouses(game, numHouses, monopoly)
}
// ===============================================================================================================

function afterTurnMenu(game) {
    updatePlayerValues(game)
    actionButtonsBox.innerHTML = ""

    // logic for make trade button
    let makeTradeBtn = document.createElement("button")
    makeTradeBtn.textContent = "Make Trade"
    makeTradeBtn.addEventListener("click", () => {
        makeTradeMenu(game)

    })
    actionButtonsBox.appendChild(makeTradeBtn)

    // logic for buy houses button
    let buyHousesBtn = document.createElement("button")
    buyHousesBtn.textContent = "Buy Houses"
    buyHousesBtn.addEventListener("click", () => {
        buyHousesMenu(game)
        
    })
    actionButtonsBox.appendChild(buyHousesBtn)

    // logic for sell houses button
    let sellHousesBtn = document.createElement("button")
    sellHousesBtn.textContent = "Sell Houses"
    sellHousesBtn.addEventListener("click", () => {
        sellHousesMenu(game)
    })
    actionButtonsBox.appendChild(sellHousesBtn)

    let endTurnBtn = document.createElement("button")
    endTurnBtn.textContent = "End Turn"
    endTurnBtn.addEventListener("click", () => {
        game.currentPlayer = switchPlayer(game)
        takeTurn(game)
    })
    actionButtonsBox.appendChild(endTurnBtn)
}

function switchPlayer(game) {
    let currentPlayer = game.currentPlayer
    let playerLength = game.players.length
    let currentPlayerIndex = game.players.indexOf(currentPlayer)
    if (currentPlayerIndex == (playerLength - 1)) {
        currentPlayer = game.players[0]
    } else {
        currentPlayer = game.players[currentPlayerIndex + 1]
    }
    return currentPlayer
}

function playGame(game) {
    console.log("entered the play Game Function") //debugging
    console.log(game.players,game.board,game.currentPlayer.name)
    // loop through until someone wins (there is one player left in game.players)
    takeTurn(game)

    // start turn for currentPlayer which is the first player in the game
}


// TESTING FUNCTIONS =============================================================================================== 
function givePlayerOneAMonopolyTesting(players, board) {
    let greenMonopoly = [board[31], board[32], board[34]]
    greenMonopoly.forEach(property => {
        property.owner = players[0]
        players[0].properties.push(property)
    })
    players[0].wallet += 10000
}

function showBoardState(board) {
    board.forEach(space => {
        console.log(space)
    })
}