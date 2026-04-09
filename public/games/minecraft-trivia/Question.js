export class Question {
    constructor(question, answer, wrongAnswers) {
        this.question = question
        this.answer = answer
        // array of 3 wrong answers
        this.wrongAnswers = wrongAnswers
    }
    generate() {
        // create form for question display
        const form = document.createElement("form")
        // creates an h2 element, sets the text content to the question, appends to form
        let question = document.createElement("h2")
        question.textContent = this.question
        form.appendChild(question)

        // create an array of the incorrect answers and the correct one
        let possibleAnswers = []
        this.wrongAnswers.forEach(answer => {
            possibleAnswers.push(answer)
        })
        possibleAnswers.push(this.answer)
        //console.log(possibleAnswers) // testing

        // loop through the answers randomly and add them to div
        let numAnswers = possibleAnswers.length
        for (let i = 0; i < numAnswers; i++) {
            let randIdx = Math.floor(Math.random() * possibleAnswers.length); // grabs index of random answer
            let answer = possibleAnswers[randIdx]
            possibleAnswers.splice(randIdx,1); // removes it from the list
            //console.log(answer) // testing

            // create button input and append it to the form
            let answerInput = document.createElement("input")
            answerInput.type = "submit"
            answerInput.value = answer
            form.appendChild(answerInput)
        }
        return form
    }
    checkAnswer(answer) {
        if (this.answer == answer) {
            console.log("you got it right!")
            return true
        }
        console.log("you got it wrong!")
        return false
    }
}

export class Trivia {
    constructor(){
        this.questions = []
    }
    add(question) {
        if (question instanceof Question) {
            this.questions.push(question)
        }
        else {
            throw new Error("must be a question object")
        }
    }
}