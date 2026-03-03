class Solution {
    public:
        int missingNumber(vector<int>& nums) {
            int n = nums.size();
            int expectedSum = n*(n+1)/2;
            int Pressum = 0;
            for(int i=0; i<n; i++){
                Pressum = Pressum + nums[i];
            }
            return expectedSum-Pressum;
        }
    };



    