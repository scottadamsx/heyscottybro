import {easyTrivia, mediumTrivia, hardTrivia} from "./db_questions.js"
import {Question, Trivia} from "./Question.js"

const questionBox = document.getElementById("questionBox")

let correct
let incorrect
let completed 

let easyTriviaSet
let mediumTriviaSet
let hardTriviaSet

const addNewBtn = document.getElementById("addNew")
addNewBtn.addEventListener("click", () => {

    let newQuestionDiv = document.getElementById("addNewDiv")
    addNewBtn.disabled = true

    let difficulty = document.createElement("label")
    difficulty.textContent = "Select a Trivia Set to add your question to"
    newQuestionDiv.append(difficulty)


    let radio = document.createElement("select")
        // easy
        let easy = document.createElement("option")
        easy.value = "easy"
        easy.textContent = "easy"
        radio.appendChild(easy)
        // medium
        let medium = document.createElement("option")
        medium.value = "medium"
        medium.textContent = "medium"
        radio.appendChild(medium)
        // hard
        let hard = document.createElement("option")
        hard.value = "hard"
        hard.textContent = "hard"
        radio.appendChild(hard)

    newQuestionDiv.appendChild(radio)
    newQuestionDiv.appendChild(document.createElement("br"))

    let questionLabel = document.createElement("label")
    questionLabel = "Question:"
    let question = document.createElement("input")
    newQuestionDiv.append(questionLabel)
    newQuestionDiv.append(question)
    newQuestionDiv.appendChild(document.createElement("br"))

    let rightAnswerLabel = document.createElement("label")
    rightAnswerLabel.textContent = "right answer"
    let rightAnswer = document.createElement("input")
    newQuestionDiv.append(rightAnswerLabel)
    newQuestionDiv.append(rightAnswer)
    newQuestionDiv.appendChild(document.createElement("br"))

    let wrongAnswer1Label = document.createElement("label")
    wrongAnswer1Label.textContent = "Wrong answer 1"
    let wrongAnswer1 = document.createElement("input")
    newQuestionDiv.append(wrongAnswer1Label)
    newQuestionDiv.append(wrongAnswer1)
    newQuestionDiv.appendChild(document.createElement("br"))
    

    let wrongAnswer2Label = document.createElement("label")
    wrongAnswer2Label.textContent = "Wrong answer 2"
    let wrongAnswer2 = document.createElement("input")
    newQuestionDiv.append(wrongAnswer2Label)
    newQuestionDiv.append(wrongAnswer2)
    newQuestionDiv.appendChild(document.createElement("br"))
   

    let wrongAnswer3Label = document.createElement("label")
    wrongAnswer3Label.textContent = "Wrong answer 3"
    let wrongAnswer3 = document.createElement("input")
    newQuestionDiv.append(wrongAnswer3Label)
    newQuestionDiv.append(wrongAnswer3)
    newQuestionDiv.appendChild(document.createElement("br"))

    let addQuestionBtn = document.createElement("button")
    addQuestionBtn.textContent = "add question"
    newQuestionDiv.append(addQuestionBtn)
    

    addQuestionBtn.addEventListener("click", () => {
        if (question.value != "" && rightAnswer.value != "" && wrongAnswer1.value != "" && wrongAnswer2.value != "" && wrongAnswer3.value != "") {
            let q = question.value
            let a = rightAnswer.value
            let w = [wrongAnswer1.value,wrongAnswer2.value,wrongAnswer3.value]
            let newQuestion = new Question(q,a,w)
            
            if (radio.value == "easy") {
                easyTriviaSet.add(newQuestion)
                sessionStorage.setItem("easyTrivia",JSON.stringify(easyTriviaSet))
                console.log(newQuestion)
                console.log(easyTriviaSet)
            } else if (radio.value == "medium") {
                mediumTriviaSet.add(newQuestion)
                sessionStorage.setItem("mediumTrivia",JSON.stringify(mediumTriviaSet))
                console.log(newQuestion)
                console.log(mediumTriviaSet)
            } else if (radio.value == "hard") {
                hardTriviaSet.add(newQuestion)
                sessionStorage.setItem("mediumTrivia",JSON.stringify(hardTriviaSet))
                console.log(newQuestion)
                console.log(hardTriviaSet)
            } 
            addNewBtn.disabled = false
            document.getElementById("result").textContent = "Question sucessfully added!"
            newQuestionDiv.innerHTML = ""
        }
        else {
            alert("you need to answer all fields")
        }
        
    })
})

function newGame() {
    let trivia;

    correct = 0 
    incorrect = 0
    completed = 0

    document.querySelector("#correct").textContent = correct
    document.querySelector("#incorrect").textContent = incorrect
    document.querySelector("#completed").textContent = completed
    
    let difficultyForm = document.createElement("div")
    questionBox.append(difficultyForm)
    let title = document.createElement("h2")
    title.style.color = "black"
    title.textContent = "Welcome to Minecraft Trivia!"
    let subTitle = document.createElement("h3")
    subTitle.textContent = "Please select your difficulty"
    difficultyForm.appendChild(title)
    difficultyForm.appendChild(subTitle)

    let radio = document.createElement("select")
        // easy
        let easy = document.createElement("option")
        easy.value = "easy"
        easy.textContent = "easy"
        radio.appendChild(easy)
        // medium
        let medium = document.createElement("option")
        medium.value = "medium"
        medium.textContent = "medium"
        radio.appendChild(medium)
        // hard
        let hard = document.createElement("option")
        hard.value = "hard"
        hard.textContent = "hard"
        radio.appendChild(hard)

    difficultyForm.appendChild(radio)

    let submit = document.createElement("button")
    submit.type = "button"
    submit.textContent = "begin"
    difficultyForm.appendChild(submit)


    submit.addEventListener("click", () => {

        let difficulty = radio.value
        if (difficulty == "easy") {
            trivia = easyTriviaSet
            console.log(trivia)
        } else if (difficulty == "medium") {
            trivia = mediumTriviaSet
            console.log(trivia)
        } else if (difficulty == "hard") {
            trivia = hardTriviaSet
            console.log(trivia)
        }
        trivia.questions = randomize(trivia.questions)
        show(trivia.questions[0], trivia.questions)
        addNewBtn.disabled = true
        difficultyForm.remove()
    })
}

function convertFromStorage(jsonString) {
    let trivia = new Trivia()
    let object = JSON.parse(jsonString)
    object.questions.forEach(q => {
        let question = new Question(q.question,q.answer,q.wrongAnswers)
        trivia.add(question)
    })
    return trivia
}


document.addEventListener("DOMContentLoaded", evt => {

    const music = document.getElementById("minecraftTheme")
    music.volume = 1.0
    
    document.addEventListener("click", function startMusic() {
    music.play()
    document.removeEventListener("click", startMusic)
    })

    // load question sets
    if (sessionStorage.easyTrivia == undefined) {
        sessionStorage.setItem("easyTrivia",JSON.stringify(easyTrivia))
        easyTriviaSet = easyTrivia
        console.log("easy questions grabbed from javascript!")
    } else {
        easyTriviaSet = convertFromStorage(sessionStorage.getItem("easyTrivia"))
        console.log("easy questions grabbed from storage!")
    }

    if (sessionStorage.mediumTrivia == undefined) {
        sessionStorage.setItem("mediumTrivia",JSON.stringify(mediumTrivia))
        mediumTriviaSet = mediumTrivia
        console.log(" medium questions grabbed from javascript!")
    } else {
        mediumTriviaSet = convertFromStorage(sessionStorage.getItem("mediumTrivia"))
        console.log(" medium questions grabbed from storage!")
    }

    if (sessionStorage.hardTrivia == undefined) {
        sessionStorage.setItem("hardTrivia",JSON.stringify(hardTrivia))
        hardTriviaSet = hardTrivia
        console.log("hard questions grabbed from javascript!")
    } else {
        hardTriviaSet = convertFromStorage(sessionStorage.getItem("hardTrivia"))
        console.log("hard questions grabbed from storage!")
    }

    newGame()
})

// accepts a question object
function show(question, questions) {
    // generate question & add it to DOM
    question.generate()
    questionBox.appendChild(question.generate())

    let form = document.querySelector("form")
    const index = questions.indexOf(question)

    form.addEventListener("submit",  evt => {
        evt.preventDefault()
        let chosenAnswer = evt.submitter.value // form submitter grabs the submit element that was used to call the event
        console.log(chosenAnswer)
        if (chosenAnswer == question.answer) {
            document.querySelector("#result").textContent = "you got it right!"
            correct++
        } else {
            document.querySelector("#result").textContent = "you got it wrong.."
            incorrect++
        }

        // remove form after question is answered
        form.remove()
        completed++

        // update display
        document.querySelector("#correct").textContent = correct
        document.querySelector("#incorrect").textContent = incorrect
        document.querySelector("#completed").textContent = completed

        // recurse through the list until theyve answered 10 questions
        if (completed < 10) {
            show(questions[index + 1],questions)
        }
        else {
            showResults()
        }
    })
}

function randomize(array) {
    // ensures arg is an array
    if (!(array instanceof Array)) {
        throw new Error("Argument must be an array")
    }
    else {
        let randomizedArray = []
        let arrayLength = array.length

        for (let i = 0; i < arrayLength; i++) {
            let randIdx = Math.floor(Math.random() * array.length); // grabs index of random answer
            let item = array[randIdx]
            array.splice(randIdx,1); // removes it from the list
            randomizedArray.push(item)
        }
        return randomizedArray
    }
}

function showResults() {
    questionBox.innerHTML = ""
    addNewBtn.disabled = false
    let results = document.querySelector("#gameResults")
    results.innerHTML = ''
    // create/display title
    document.getElementById("result").textContent = "Game Over!"
    results.appendChild(document.createElement("br"))
    // create/display score
    let score = document.createElement("h2")
    score.innerHTML = `Your Score: ${correct}/${completed} <br> Your percentage: ${correct / completed * 100}%`
    results.appendChild(score)
    results.appendChild(document.createElement("br"))

    // play again button
    let playAgainBtn = document.createElement("button")
    playAgainBtn.textContent = "Play Again"
    playAgainBtn.addEventListener("click", () => {
        results.innerHTML = ""
        newGame()
    })
    results.appendChild(playAgainBtn)
}
