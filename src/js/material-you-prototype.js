(function () {
    window.addEventListener('load', helloWorld());

    function helloWorld() {
        new Vue({
            el: '#appContent',
            data: {
                headerText: '',
                isHeaderTextHidden: false
            },
            mounted() {
                var greeting = 'Good ';
                var mHour = new Date().getHours();
                switch (mHour) {
                    case 0:
                    case 1:
                    case 2:
                    case 3:
                    case 4:
                        greeting += 'evening';
                        break;
                    case 5:
                    case 6:
                    case 7:
                    case 8:
                    case 9:
                    case 10:
                    case 11:
                        greeting += 'morning';
                        break;
                    case 12:
                    case 13:
                    case 14:
                    case 15:
                    case 16:
                        greeting += 'afternoon';
                        break;
                    case 17:
                    case 18:
                    case 19:
                    case 20:
                    case 21:
                    case 22:
                    case 23:
                        greeting += 'evening';
                        break;
                }
                greeting += ' ';
                greeting += 'Alex';
                this.headerText = greeting;
                //greeting += utils._FIRSTNAME;

                var tl = anime.timeline({});

                var self = this;

                tl.add({
                    targets: this.$refs.headerText,
                    translateY: ['-25%', '0%'],
                    opacity: [0, 1],
                    delay: 250,
                    duration: 200,

                    easing: 'easeInOutQuad'
                }).add({
                    targets: this.$refs.headerText,
                    translateY: ['0%', '50%'],
                    opacity: [1, 0],
                    duration: 200,
                    easing: 'easeInOutQuad',
                    complete: function (anim) {
                        self.headerText = 'Let\'s get started';
                    }
                }, '+=775').add({
                    targets: this.$refs.headerText,
                    translateY: ['-50%', '0%'],
                    opacity: [0, 1],
                    duration: 200,
                    easing: 'easeInOutQuad'
                }, '+=30');

                anime({
                    targets: this.$refs.explorePaneContent,
                    translateY: ['5%', '0%'],
                    opacity: [0, 1],
                    duration: 250,
                    delay: 250,
                    easing: 'easeOutQuad'
                });
            },
            methods: {
                clickedBrowse: function () {
                    this.navigateForward(this.$refs.exploreMenuContainer, this.$refs.filterRecipesContainer, this.$refs.fromFilterToHomeBackButtonImg, this.$refs.fromFilterToHomeBackButtonText);
                },
                clickedMealPlan: function () {
                    console.log('Hello World');
                },

                getAbsoluteHeight: function (el) {
                    el = (typeof el === 'string') ? document.querySelector(el) : el;

                    var styles = window.getComputedStyle(el);
                    var margin = parseFloat(styles['marginTop']) + parseFloat(styles['marginBottom']);

                    return Math.ceil(el.offsetHeight + margin);
                },

                navigateForward: function (from, to, backButtonImg, backButtonText) {
                    var self = this;

                    var headerTextHeight = this.getAbsoluteHeight(this.$refs.headerText);
                    var h = '-' + headerTextHeight + 'px';

                    var timeline = anime.timeline({});
                    timeline
                        .add({
                            targets: from,
                            translateX: ['0%', '-50%'],
                            opacity: [1, 0],
                            duration: 200,
                            easing: 'easeInOutQuad',
                            complete: function (anim) {
                                from.classList.add('d-none');
                            }
                        })
                        .add({
                            targets: to,
                            translateX: ['50%', '0%'],
                            opacity: [0, 1],
                            duration: 200,
                            easing: 'easeInOutQuad',
                            begin: function (anim) {
                                to.classList.add('d-block');
                            }
                        }, '+=5')
                        .add({
                            targets: backButtonText,
                            translateX: ['-0.5rem', '0rem'],
                            opacity: [0, 1],
                            duration: 200,
                            easing: 'easeInOutQuad',
                            delay: 100
                        })
                        .add({
                            targets: backButtonImg,
                            opacity: [0, 1],
                            duration: 200,
                            easing: 'easeInOutQuad',
                            delay: 200
                        }, '-=200');

                    if (this.isHeaderTextHidden) {
                        return;
                    }

                    var headerTextTimeline = anime.timeline({});
                    headerTextTimeline
                        .add({
                            targets: this.$refs.headerText,
                            translateY: ['0px', h],
                            opacity: [1, 0],
                            duration: 250,
                            easing: 'easeInOutQuad',
                            complete: function (anim) {
                                //self.$refs.headerText.classList.add('d-none');
                                self.isHeaderTextHidden = true;
                            }
                        })
                        .add({
                            targets: this.$refs.explorePaneContent,
                            translateY: ['0px', h],
                            duration: 250,
                            easing: 'easeInOutQuad'
                        }, '-=250');
                }
            }
        });
    }
})();