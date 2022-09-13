/*jshint esversion: 8 */
(function () {
    window.addEventListener('load', function () {
        new Vue({
            el: '#appContent',
            data: {
                showStep1: false,
                showStep2: false,
                showStep3: true,
                addRecipeSelectedTags: []
            },
            components: {
                "tags-input": VoerroTagsInput
            },
            methods: {
                addRecipe_ToStepOne() {
                    this.showStep1 = true;
                    this.showStep2 = false;
                    this.showStep3 = false;
                },
                addRecipe_ToStepTwo() {
                    this.showStep1 = false;
                    this.showStep2 = true;
                    this.showStep3 = false;
                },
                addRecipe_ToStepThree() {
                    this.showStep1 = false;
                    this.showStep2 = false;
                    this.showStep3 = true;
                },
                clickedFinishAddRecipe() {
                    console.log('Added Recipe!');
                },
                /* Add Recipe Lottie enter/exit animations */
                enterAddRecipeLottieAnimation(el, done) {
                    anime({
                        targets: el,
                        translateX: [15, 0],
                        opacity: [0, 1],
                        easing: 'easeInOutSine',
                        duration: 105,
                        complete: done,
                    });
                },
                leaveAddRecipeLottieAnimation(el, done) {
                    anime({
                        targets: el,
                        translateX: [0, -15],
                        opacity: [1, 0],
                        easing: 'easeInOutSine',
                        duration: 105,
                        complete: done
                    });
                },
                /* Add Recipe Content */
                enterAddRecipeContentAnimation(el, done) {
                    anime({
                        targets: el,
                        translateX: [30, 0],
                        opacity: [0, 1],
                        easing: 'easeInOutSine',
                        duration: 105,
                        complete: done,
                    });
                },
                leaveAddRecipeContentAnimation(el, done) {
                    anime({
                        targets: el,
                        translateX: [0, -30],
                        opacity: [1, 0],
                        easing: 'easeInOutSine',
                        duration: 105,
                        complete: done
                    });
                }
            }
        });
    });
})();